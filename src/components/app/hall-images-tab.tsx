import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  deleteHallImage,
  reorderHallImages,
  uploadHallImage,
  type HallImage,
} from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function HallImagesTab({
  hallId,
  images,
  onChange,
  onReload,
  canManage,
}: {
  hallId: string;
  images: HallImage[];
  onChange: (next: HallImage[]) => void;
  /** Re-fetch the hall (used after upload, since the new image's shape comes from the server). */
  onReload: () => Promise<void>;
  canManage: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HallImage | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const bad = list.find((f) => !ACCEPT.includes(f.type));
    if (bad) {
      toast.error(`${bad.name}: only JPEG, PNG or WebP images are allowed.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const file of list) {
      try {
        await withAuthRetry((t) => uploadHallImage(t, hallId, file));
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof ApiError ? err.message : "upload failed."}`);
      }
    }
    if (ok) {
      toast.success(ok === 1 ? "Image uploaded" : `${ok} images uploaded`);
      await onReload();
    }
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
  }

  async function drop(targetId: string) {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId || busy) return;
    const prev = images;
    const next = [...prev];
    const fi = next.findIndex((i) => i.public_id === from);
    const ti = next.findIndex((i) => i.public_id === targetId);
    if (fi < 0 || ti < 0) return;
    const [moved] = next.splice(fi, 1);
    next.splice(ti, 0, moved);
    onChange(next);
    setBusy(true);
    try {
      await withAuthRetry((t) =>
        reorderHallImages(
          t,
          hallId,
          next.map((i) => i.public_id),
        ),
      );
      toast.success("Image order saved");
    } catch (err) {
      onChange(prev);
      toast.error(err instanceof ApiError ? err.message : "Unable to save image order.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusy(true);
    try {
      await withAuthRetry((t) => deleteHallImage(t, hallId, target.public_id));
      onChange(images.filter((i) => i.public_id !== target.public_id));
      toast.success("Image deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          JPEG, PNG or WebP.{" "}
          {canManage && images.length > 1 && "Drag images to reorder; the first is the cover."}
        </p>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              multiple
              hidden
              onChange={(e) => void upload(e.target.files)}
            />
            <Button disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Upload image
            </Button>
          </>
        )}
      </div>

      {images.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          title="No images yet"
          description="Upload photos so customers can see the hall."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, idx) => (
            <li
              key={img.public_id}
              draggable={canManage && !busy}
              onDragStart={() => setDragId(img.public_id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(img.public_id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void drop(img.public_id);
              }}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted",
                canManage && !busy && "cursor-grab",
                dragId === img.public_id && "opacity-40",
                overId === img.public_id &&
                  dragId &&
                  dragId !== img.public_id &&
                  "ring-2 ring-primary",
              )}
            >
              <img
                src={img.url}
                alt={`Hall image ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold">
                  Cover
                </span>
              )}
              {canManage && (
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Delete image"
                  disabled={busy}
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                  onClick={() => setDeleteTarget(img)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !busy && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
