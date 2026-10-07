"use server";

/**
 * Deal attachment actions — signed upload URLs (client uploads directly to
 * Supabase Storage, then calls confirmUpload), signed download URLs (1hr),
 * and deletion. Bucket `deal-attachments` must exist in Supabase Storage.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DealAttachmentRow } from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/types";

const BUCKET = "deal-attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

async function signedIn() {
  const session = await getCurrentUser();
  if (!session) return { ok: false as const, error: "Not signed in." };
  return { ok: true as const, session };
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

const uploadUrlSchema = z.object({
  dealId: z.string().uuid(),
  fileName: z.string().trim().min(1, "File name is required.").max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export interface UploadUrlData {
  attachmentId: string;
  path: string;
  /** Signed URL for the direct-to-storage upload. */
  signedUrl: string;
  /** Token for `uploadToSignedUrl(path, token, file)`. */
  token: string;
}

/**
 * Validate the file, create the `deal_attachments` row (pending upload),
 * and return signed upload info. The client uploads directly to Storage,
 * then calls `confirmUpload({ attachmentId })`.
 */
export async function getUploadUrl(
  input: z.input<typeof uploadUrlSchema>,
): Promise<ActionResult<UploadUrlData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { dealId, fileName, mimeType, size } = parsed.data;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Only PDF, DOCX, XLSX, PNG and JPG files are allowed." };
  }
  if (size > MAX_BYTES) {
    return { ok: false, error: "Files must be 10 MB or smaller." };
  }

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .is("deleted_at", null)
    .single();
  if (!deal) return { ok: false, error: "Deal not found." };

  const path = `${dealId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const { data: row, error: rowError } = await supabase
    .from("deal_attachments")
    .insert({
      deal_id: dealId,
      file_name: sanitizeFileName(fileName),
      storage_path: path,
      mime_type: mimeType,
      size_bytes: size,
      uploaded_by: auth.session.id,
    })
    .select("id")
    .single();
  if (rowError || !row) return { ok: false, error: "Could not prepare the upload." };

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    await supabase.from("deal_attachments").delete().eq("id", (row as { id: string }).id);
    return { ok: false, error: "Could not create the upload URL." };
  }

  return {
    ok: true,
    data: {
      attachmentId: (row as { id: string }).id,
      path: signed.path,
      signedUrl: signed.signedUrl,
      token: signed.token,
    },
  };
}

const confirmUploadSchema = z.object({ attachmentId: z.string().uuid() });

/**
 * Mark a pending upload complete. Verifies the object actually landed in
 * Storage; otherwise removes the row so Files never shows ghost entries.
 */
export async function confirmUpload(
  input: z.input<typeof confirmUploadSchema>,
): Promise<ActionResult<DealAttachmentRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = confirmUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("deal_attachments")
    .select("*")
    .eq("id", parsed.data.attachmentId)
    .single();
  if (error || !row) return { ok: false, error: "Attachment not found." };
  const attachment = row as DealAttachmentRow;

  const { data: exists } = await supabase.storage.from(BUCKET).list(attachment.deal_id, {
    search: attachment.storage_path.split("/").pop() ?? "",
  });
  const landed = (exists ?? []).some(
    (o) => attachment.storage_path === `${attachment.deal_id}/${o.name}`,
  );
  if (!landed) {
    await supabase.from("deal_attachments").delete().eq("id", attachment.id);
    return { ok: false, error: "The upload didn't complete. Please try again." };
  }

  revalidatePath(`/deals/${attachment.deal_id}`);
  return { ok: true, data: attachment };
}

const attachmentIdSchema = z.object({ attachmentId: z.string().uuid() });

/** Signed download URL valid for 1 hour. */
export async function getDownloadUrl(
  input: z.input<typeof attachmentIdSchema>,
): Promise<ActionResult<{ url: string }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = attachmentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("deal_attachments")
    .select("storage_path")
    .eq("id", parsed.data.attachmentId)
    .single();
  if (error || !row) return { ok: false, error: "Attachment not found." };

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl((row as DealAttachmentRow).storage_path, 3600);
  if (signError || !signed) return { ok: false, error: "Could not create the download link." };
  return { ok: true, data: { url: signed.signedUrl } };
}

/** Delete an attachment — the deal's owner or an admin. */
export async function deleteAttachment(
  input: z.input<typeof attachmentIdSchema>,
): Promise<ActionResult<null>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = attachmentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("deal_attachments")
    .select("*, deal:deal_id (owner_id)")
    .eq("id", parsed.data.attachmentId)
    .single();
  if (error || !row) return { ok: false, error: "Attachment not found." };
  const attachment = row as DealAttachmentRow & {
    deal: { owner_id: string } | null;
  };

  const isOwner = attachment.deal?.owner_id === auth.session.id;
  const isAdmin = auth.session.profile.role === "admin";
  if (!isOwner && !isAdmin) {
    return { ok: false, error: "Only the deal owner or an admin can delete files." };
  }

  await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
  const { error: deleteError } = await supabase
    .from("deal_attachments")
    .delete()
    .eq("id", attachment.id);
  if (deleteError) return { ok: false, error: "Could not delete the file." };

  revalidatePath(`/deals/${attachment.deal_id}`);
  return { ok: true, data: null };
}
