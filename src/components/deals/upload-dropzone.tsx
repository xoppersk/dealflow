"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { confirmUpload, getUploadUrl } from "@/lib/actions/attachments";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);
const MAX_BYTES = 10 * 1024 * 1024;

interface UploadState {
  id: string;
  name: string;
  progress: number; // 0–100
  error?: string;
}

interface UploadDropzoneProps {
  dealId: string;
  onUploaded?: () => void;
}

/**
 * Drag-and-drop upload zone. Validates type/size client-side, fetches a
 * signed upload URL, uploads directly to Supabase Storage, then confirms
 * the attachment row. Per-file progress + error display.
 */
export function UploadDropzone({ dealId, onUploaded }: UploadDropzoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  function validate(file: File): string | null {
    if (!ALLOWED_MIME.has(file.type)) return "Only PDF, DOCX, XLSX, PNG and JPG files are allowed.";
    if (file.size > MAX_BYTES) return "Files must be 10 MB or smaller.";
    return null;
  }

  async function uploadOne(file: File) {
    const id = `${file.name}-${Date.now()}`;
    setUploads((u) => [...u, { id, name: file.name, progress: 5 }]);

    const fail = (error: string) =>
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, error, progress: 100 } : x)));

    const signed = await getUploadUrl({
      dealId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (!signed.ok) {
      fail(signed.error);
      return;
    }

    setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: 30 } : x)));
    const supabase = createClient();
    const { error: storageError } = await supabase.storage
      .from("deal-attachments")
      .uploadToSignedUrl(signed.data.path, signed.data.token, file);
    if (storageError) {
      fail("Upload failed — please try again.");
      return;
    }

    setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: 80 } : x)));
    const confirmed = await confirmUpload({ attachmentId: signed.data.attachmentId });
    if (!confirmed.ok) {
      fail(confirmed.error);
      return;
    }

    setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: 100 } : x)));
    toast.success(`"${file.name}" uploaded.`);
    router.refresh();
    onUploaded?.();
  }

  function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const problem = validate(file);
      if (problem) {
        toast.error(`"${file.name}" — ${problem}`);
        continue;
      }
      void uploadOne(file);
    }
  }

  return (
    <div className="grid gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50",
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop files here or <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, PNG, JPG — up to 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="grid gap-2">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                {u.error ? (
                  <p className="text-xs text-destructive">{u.error}</p>
                ) : (
                  <Progress value={u.progress} className="mt-1" />
                )}
              </div>
              {u.progress === 100 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Dismiss"
                  onClick={() => setUploads((all) => all.filter((x) => x.id !== u.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {u.progress < 100 && !u.error && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
