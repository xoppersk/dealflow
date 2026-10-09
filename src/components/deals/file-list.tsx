"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAttachment, getDownloadUrl } from "@/lib/actions/attachments";
import type { DealAttachmentRow } from "@/lib/supabase/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileListProps {
  attachments: DealAttachmentRow[];
  canDelete: boolean;
}

/** Attachment list with signed-URL downloads and deletion. */
export function FileList({ attachments, canDelete }: FileListProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DealAttachmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function download(a: DealAttachmentRow) {
    setDownloading(a.id);
    const res = await getDownloadUrl({ attachmentId: a.id });
    setDownloading(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteAttachment({ attachmentId: pendingDelete.id });
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("File deleted.");
    setPendingDelete(null);
    router.refresh();
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No files yet — drop one above.</p>;
  }

  return (
    <>
      <ul className="grid gap-2">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-[2px] border px-3 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.file_name}</p>
              <p className="text-xs text-muted-foreground tnum">
                {formatBytes(a.size_bytes)} · {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Download ${a.file_name}`}
              disabled={downloading === a.id}
              onClick={() => download(a)}
            >
              {downloading === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label={`Delete ${a.file_name}`}
                onClick={() => setPendingDelete(a)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete file?"
        description={`"${pendingDelete?.file_name}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete file"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
