"use client";

import { FileImage, FileSpreadsheet, FileText, Paperclip, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { formatBytes } from "../audit-describe";
import { formatDateTime } from "../format";
import { openDocument, useSignedUrls } from "../storage/documents";
import { formatLimit, typeLabel } from "../storage/file-check";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState } from "@/ui/empty-state";
import { FormMessage, Select } from "@/ui/field";
import { StatusBadge, type StatusTone } from "@/ui/status-badge";
import { Tile, type TileSize } from "@/ui/tile";
import {
  useAttachmentQueue,
  useAttachments,
  useChangeAttachmentCategory,
  useRemoveAttachment,
  type Attachment,
  type AttachmentEntity,
  type AttachmentQueue,
  type QueueStatus,
} from "./api";

const isImage = (mime: string) => /^image\/(png|jpeg|webp)$/.test(mime);

function FileIcon({ mime }: { mime: string }) {
  const Icon = isImage(mime) ? FileImage : /spreadsheet/.test(mime) ? FileSpreadsheet : FileText;
  return <Icon aria-hidden className="size-5 shrink-0 text-neutral-500" />;
}

/** Drop zone: drag & drop, Ctrl+V (also anywhere on the page outside text fields), file picker,
 *  and on a phone the camera. */
export function AttachmentDropZone({
  queue,
  onFiles,
  disabled = false,
}: {
  queue: AttachmentQueue;
  onFiles?: () => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const cameraId = useId();
  const [over, setOver] = useState(false);
  const accept = [...new Set(queue.rules.flatMap((r) => r.allowed_mime_types))].join(",");
  const limits = queue.rules
    .map((r) => `${r.label} ${formatLimit(r.max_bytes)}`)
    .filter((v, i, a) => a.indexOf(v) === i);
  const addFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0 || disabled) return;
    queue.add(files);
    onFiles?.();
  };
  const addRef = useRef(addFiles);
  useEffect(() => {
    addRef.current = addFiles;
  });

  // Ctrl+V anywhere on the page, unless the user is typing into a field
  useEffect(() => {
    const onPaste = (e: globalThis.ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        addRef.current(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div
      data-testid="attachment-drop"
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        addFiles(e.dataTransfer.files);
      }}
      onPaste={(e: ClipboardEvent) => {
        if (e.clipboardData.files.length) {
          e.preventDefault();
          e.stopPropagation();
          addFiles(e.clipboardData.files);
        }
      }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-dashed p-4 text-[15px] transition-colors",
        over ? "border-navy bg-canvas" : "border-neutral-200",
      )}
    >
      <p className="flex items-center gap-2 text-neutral-700">
        <Paperclip aria-hidden className="size-4" />
        Pretiahnite súbory sem, vložte ich cez Ctrl+V alebo
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={inputId} className="sr-only">
          Vybrať súbory
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          disabled={disabled}
          data-testid="attachment-input"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          Vybrať súbory
        </Button>
        {/* phone: straight to the camera */}
        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          tabIndex={-1}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          className="md:hidden"
          disabled={disabled}
          onClick={() => document.getElementById(cameraId)?.click()}
        >
          Odfotiť
        </Button>
      </div>
      {limits.length > 0 && (
        <p className="text-[13px] text-neutral-500">
          Limity: {limits.join(" · ")}. Fotky sa pred nahraním zmenšia (max. 2000 px).
        </p>
      )}
    </div>
  );
}

const STATUS: Record<QueueStatus, { label: string; tone: StatusTone }> = {
  waiting: { label: "Čaká", tone: "neutral" },
  uploading: { label: "Nahrávam…", tone: "info" },
  done: { label: "Hotovo", tone: "success" },
  error: { label: "Chyba", tone: "danger" },
};

/** Files in the queue: category per file, state per file and overall "n/m". */
export function AttachmentQueueList({ queue }: { queue: AttachmentQueue }) {
  if (queue.items.length === 0) return null;
  const done = queue.items.filter((i) => i.status === "done").length;
  return (
    <div className="flex flex-col gap-2" data-testid="attachment-queue">
      <p className="text-[13px] text-neutral-700 tabular-nums" aria-live="polite">
        Nahrané {done}/{queue.items.length}
      </p>
      <ul className="flex flex-col divide-y divide-neutral-200">
        {queue.items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <FileIcon mime={i.file.type} />
            <span className="min-w-0 flex-1 truncate">{i.file.name}</span>
            <span className="text-[13px] text-neutral-500 tabular-nums">
              {formatBytes(i.file.size)}
            </span>
            <Select
              aria-label={`Kategória – ${i.file.name}`}
              className="h-8 w-40 text-[13px]"
              value={i.category}
              disabled={i.status === "uploading" || i.status === "done"}
              onChange={(e) => queue.setCategory(i.key, e.target.value)}
            >
              {queue.rules.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </Select>
            <StatusBadge label={STATUS[i.status].label} tone={STATUS[i.status].tone} />
            {i.status !== "uploading" && i.status !== "done" && (
              <Button
                variant="ghost"
                className="h-8 px-2"
                aria-label={`Odobrať zo zoznamu – ${i.file.name}`}
                onClick={() => queue.remove(i.key)}
              >
                <X aria-hidden className="size-4" />
              </Button>
            )}
            {i.error && (
              <p className="text-danger w-full text-[13px]" role="alert">
                {i.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Attachments in the form of a NEW record: files are only collected; they are uploaded after the
 * record is saved (Cancel uploads nothing). When some fail, the record stays saved and they can
 * be uploaded again from here.
 */
export function NewRecordAttachments({
  queue,
  retry,
  busy = false,
}: {
  queue: AttachmentQueue;
  /** set after saving when some files failed: uploads them again to the saved record */
  retry?: () => void;
  busy?: boolean;
}) {
  const failed = queue.items.filter((i) => i.status === "error").length;
  return (
    <section aria-label="Prílohy nového záznamu" className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
        Fotky a prílohy
      </h3>
      <p className="text-[13px] text-neutral-700">
        Súbory sa nahrajú po uložení záznamu; pri „Zrušiť“ sa nič nenahrá. Prvá fotka bude hlavná.
      </p>
      <AttachmentDropZone queue={queue} disabled={busy || queue.busy} />
      <AttachmentQueueList queue={queue} />
      {retry && failed > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <FormMessage tone="error">
            Záznam je uložený, ale {failed}{" "}
            {failed === 1 ? "súbor sa nenahral" : "súbory sa nenahrali"}.
          </FormMessage>
          <Button variant="secondary" onClick={retry} disabled={queue.busy}>
            Nahrať znova
          </Button>
        </div>
      )}
    </section>
  );
}

/** Photo preview inside the app (Esc / button closes). */
function Preview({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Náhľad – ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL of a private file */}
      <img src={url} alt={name} className="max-h-full max-w-full rounded-lg bg-white" />
      <Button variant="secondary" className="absolute top-4 right-4" onClick={onClose}>
        Zavrieť
      </Button>
    </div>
  );
}

/**
 * ONE "Prílohy" tile for all modules (D23): list with type, name, category, size, who and when;
 * photos as a gallery with a preview; PDF in a new tab, other types as a download (link 60 s);
 * category change; delete with confirmation (locked documents never).
 */
export function AttachmentsTile({
  entityTable,
  entityId,
  size = "XL",
  mainPhotoId,
  onSetMainPhoto,
  onUploaded,
}: {
  entityTable: AttachmentEntity;
  entityId: string;
  size?: TileSize;
  /** catalog items: the main photo is marked and can be chosen */
  mainPhotoId?: string | null;
  onSetMainPhoto?: (documentId: string) => void;
  /** after an upload (e.g. the first photo becomes the main photo) */
  onUploaded?: (docs: { id: string; category: string }[]) => void;
}) {
  const list = useAttachments(entityTable, entityId);
  const queue = useAttachmentQueue();
  const remove = useRemoveAttachment();
  const change = useChangeAttachmentCategory();
  const [confirm, setConfirm] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const rows = list.data ?? [];
  const photos = rows.filter((r) => isImage(r.mime_type));
  const thumbs = useSignedUrls(photos.map((p) => p.storage_path));

  // new files are uploaded right away; finished ones leave the queue once the list has them
  const [runToken, setRunToken] = useState(0);
  const { run, clearDone } = queue;
  useEffect(() => {
    if (runToken === 0) return;
    void run(entityTable, entityId).then(({ stored }) => {
      if (stored.length) onUploaded?.(stored);
      setTimeout(clearDone, 1500);
    });
  }, [runToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (a: Attachment, download = false) => {
    setOpenError(null);
    try {
      window.open(await openDocument(a, { download }), "_blank", "noopener");
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Tile size={size} title="Prílohy">
      <div className="flex flex-col gap-4">
        <AttachmentDropZone
          queue={queue}
          onFiles={() => setRunToken((n) => n + 1)}
          disabled={queue.busy}
        />
        <AttachmentQueueList queue={queue} />
        {list.error && <FormMessage tone="error">{list.error.message}</FormMessage>}
        {(remove.error || change.error || openError) && (
          <FormMessage tone="error">
            {remove.error?.message ?? change.error?.message ?? openError}
          </FormMessage>
        )}

        {photos.length > 0 && (
          <ul aria-label="Galéria" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => {
              const url = thumbs.data?.get(p.storage_path);
              return (
                <li key={p.id} className="relative">
                  <button
                    type="button"
                    className="bg-canvas block aspect-square w-full overflow-hidden rounded-lg border border-neutral-200"
                    onClick={() => setPreview(p)}
                    aria-label={`Náhľad – ${p.file_name}`}
                  >
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element -- signed URL of a private file
                      <img src={url} alt="" className="size-full object-cover" />
                    )}
                  </button>
                  {mainPhotoId === p.id && (
                    <span className="bg-navy absolute top-1 left-1 rounded px-1.5 text-[11px] font-semibold text-white">
                      Hlavná
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {list.data && rows.length === 0 && queue.items.length === 0 ? (
          <EmptyState
            title="Zatiaľ bez príloh"
            description="Fotky, technické listy, certifikáty, zmluvy, výkresy."
          />
        ) : (
          <ul aria-label="Zoznam príloh" className="flex flex-col divide-y divide-neutral-200">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                data-testid="attachment-row"
              >
                <FileIcon mime={a.mime_type} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="text-navy max-w-full truncate text-left font-medium hover:underline"
                    onClick={() => (isImage(a.mime_type) ? setPreview(a) : void open(a))}
                  >
                    {a.file_name}
                  </button>
                  <p className="text-[13px] text-neutral-500 tabular-nums">
                    {typeLabel(a.mime_type)} · {formatBytes(a.size_bytes)} ·{" "}
                    {a.created_by_name ?? "—"} · {formatDateTime(a.created_at)}
                  </p>
                </div>
                {mainPhotoId === a.id && <StatusBadge label="Hlavná fotka" tone="info" />}
                {a.is_locked && <StatusBadge label="Zamknutý" />}
                <Select
                  aria-label={`Kategória – ${a.file_name}`}
                  className="h-8 w-40 text-[13px]"
                  value={a.category}
                  disabled={a.is_locked || change.isPending}
                  onChange={(e) => change.mutate({ id: a.id, category: e.target.value })}
                >
                  {queue.rules.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </Select>
                <span className="flex flex-wrap gap-1">
                  {onSetMainPhoto && a.category === "photo" && mainPhotoId !== a.id && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-[13px]"
                      onClick={() => onSetMainPhoto(a.id)}
                    >
                      Nastaviť ako hlavnú
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-[13px]"
                    onClick={() => void open(a, true)}
                    aria-label={`Stiahnuť – ${a.file_name}`}
                  >
                    Stiahnuť
                  </Button>
                  {!a.is_locked && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-[13px]"
                      onClick={() => setConfirm(a)}
                      aria-label={`Zmazať – ${a.file_name}`}
                    >
                      Zmazať
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview && thumbs.data?.get(preview.storage_path) && (
        <Preview
          url={thumbs.data.get(preview.storage_path)!}
          name={preview.file_name}
          onClose={() => setPreview(null)}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Zmazať prílohu – ${confirm?.file_name ?? ""}?`}
        confirmLabel="Zmazať"
        busy={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && remove.mutate(confirm, { onSettled: () => setConfirm(null) })}
      >
        {mainPhotoId === confirm?.id
          ? "Súbor sa natrvalo odstráni. Je to hlavná fotka položky – položka zostane bez fotky."
          : "Súbor sa natrvalo odstráni. Záznam o zmazaní ostane v histórii zmien."}
      </ConfirmDialog>
    </Tile>
  );
}
