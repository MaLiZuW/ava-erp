"use client";

/**
 * Documents core (ARCHITECTURE_CORE.md §2 "Prílohy", D23): a file in the private bucket via the
 * storage adapter + a row in public.documents with SHA-256. Used by the company logo, the content
 * library and the attachments of all modules.
 */
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "../supabase/client";
import type { Tables } from "../supabase/database.types";
import { throwDb, type DbMessages } from "../supabase/errors";
import { checkImageFile, safeFileName } from "../validation";
import { storageFor, type StorageProvider } from "./adapter";
import { checkAttachmentFile, fileMime, readEnds, type CategoryRule } from "./file-check";
import { resizeImage } from "./resize-image";

export type DocumentRow = Tables<"documents">;

const sb = () => getSupabase();
const PROVIDER: StorageProvider = "supabase";

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** DB refusals of the file check (private.check_attachment_file) in plain Slovak. */
const DOCUMENT_MESSAGES: DbMessages = {
  "23514": "Súbor nespĺňa pravidlá kategórie (typ alebo veľkosť).",
  "42501": "Zamknutý dokument sa nedá zmeniť ani zmazať.",
};

/** Path: YYYY/<entity_table>/<entity_id>/<uuid>-<name>. Never overwrites an object. */
async function storeDocument({
  entityTable,
  entityId,
  category,
  file,
  mime,
}: {
  entityTable: string;
  entityId: string;
  category: string;
  file: File;
  mime: string;
}): Promise<DocumentRow> {
  const year = new Date().getFullYear();
  const path = `${year}/${entityTable}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const sha256 = await sha256Hex(file);
  const storage = storageFor(PROVIDER);
  await storage.upload(path, file, mime);

  const doc = await sb()
    .from("documents")
    .insert({
      entity_table: entityTable,
      entity_id: entityId,
      category,
      storage_provider: PROVIDER,
      storage_bucket: "documents",
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: mime,
      size_bytes: file.size,
      sha256,
    })
    .select()
    .single();
  if (doc.error) {
    await storage.remove([path]).catch(() => undefined); // do not leave an orphaned object
    throwDb(doc.error, DOCUMENT_MESSAGES);
  }
  return doc.data;
}

/** Uploads an image (PNG/JPEG/WebP ≤ 2 MB) – the company logo and content images. */
export async function uploadImageDocument({
  entityTable,
  entityId,
  category,
  file,
}: {
  entityTable: string;
  entityId: string;
  category: "logo" | "content_image";
  file: File;
}): Promise<DocumentRow> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const problem = checkImageFile(file, head);
  if (problem) throw new Error(problem);
  return storeDocument({ entityTable, entityId, category, file, mime: file.type });
}

/**
 * Uploads an attachment (D23): photos are made smaller first (WebP, max 2000 px), then the file
 * is checked against its category (type, size, content) and stored.
 */
export async function uploadAttachment({
  entityTable,
  entityId,
  category,
  file,
}: {
  entityTable: string;
  entityId: string;
  category: CategoryRule;
  file: File;
}): Promise<DocumentRow> {
  const ready = category.code === "photo" ? await resizeImage(file) : file;
  const problem = checkAttachmentFile(ready, await readEnds(ready), category);
  if (problem) throw new Error(problem);
  return storeDocument({
    entityTable,
    entityId,
    category: category.code,
    file: ready,
    mime: fileMime(ready),
  });
}

/** Removes an unlocked document: the row and its stored object (locked ones are refused by the DB). */
export async function removeDocument(
  doc: Pick<DocumentRow, "id" | "storage_path"> & { storage_provider?: string | null },
): Promise<void> {
  const { error } = await sb().from("documents").delete().eq("id", doc.id);
  if (error) throwDb(error, DOCUMENT_MESSAGES);
  await storageFor(doc.storage_provider).remove([doc.storage_path]);
}

export function useDocuments(ids: readonly string[]) {
  return useQuery({
    queryKey: ["documents", "ids", ...ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("documents")
        .select("*")
        .in("id", [...ids]);
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

/** Short-lived signed URL (private bucket) for an image preview. */
export function useSignedUrl(path: string | null | undefined, provider?: string | null) {
  return useQuery({
    queryKey: ["signed_url", path ?? null],
    enabled: !!path,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      try {
        return await storageFor(provider).signedUrl(path!, { seconds: 300 });
      } catch {
        throw new Error("Náhľad obrázka sa nepodarilo načítať.");
      }
    },
  });
}

/** Many previews at once (thumbnails in lists): path → URL. */
export function useSignedUrls(paths: readonly string[]) {
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ["signed_urls", ...sorted],
    enabled: sorted.length > 0,
    staleTime: 4 * 60_000,
    queryFn: () => storageFor(PROVIDER).signedUrls(sorted, 300),
  });
}

/** Opens a document: PDF/images inline in a new tab, other types as a download (link 60 s). */
export async function openDocument(
  doc: Pick<DocumentRow, "storage_path" | "file_name" | "mime_type"> & {
    storage_provider?: string | null;
  },
  { download = false }: { download?: boolean } = {},
): Promise<string> {
  const inline = !download && /^(application\/pdf|image\/(png|jpeg|webp))$/.test(doc.mime_type);
  return storageFor(doc.storage_provider).signedUrl(doc.storage_path, {
    seconds: 60,
    download: inline ? undefined : doc.file_name,
  });
}
