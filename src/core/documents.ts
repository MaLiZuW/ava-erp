"use client";

/**
 * Documents core (ARCHITECTURE_CORE.md §2 "Prílohy"): file in the private bucket "documents"
 * + a row in public.documents with SHA-256. Used by the company logo and the content library.
 */
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "./supabase/client";
import type { Tables } from "./supabase/database.types";
import { throwDb } from "./supabase/errors";
import { checkImageFile, safeFileName } from "./validation";

export type DocumentRow = Tables<"documents">;

const sb = () => getSupabase();

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads an image (PNG/JPEG/WebP ≤ 2 MB) and records it in public.documents.
 * Path: YYYY/<entity_table>/<entity_id>/<uuid>-<name>. Never overwrites an object.
 */
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

  const year = new Date().getFullYear();
  const path = `${year}/${entityTable}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const sha256 = await sha256Hex(file);

  // upsert: false – an existing object is never overwritten (also refused by storage RLS)
  const up = await sb().storage.from("documents").upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "300",
  });
  if (up.error)
    throw new Error("Nahranie súboru sa nepodarilo (povolené: PNG, JPEG, WebP do 2 MB).");

  const doc = await sb()
    .from("documents")
    .insert({
      entity_table: entityTable,
      entity_id: entityId,
      category,
      storage_bucket: "documents",
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      sha256,
    })
    .select()
    .single();
  if (doc.error) {
    await sb().storage.from("documents").remove([path]); // do not leave an orphaned object
    throwDb(doc.error);
  }
  return doc.data;
}

/** Removes an unlocked document: the row and its stored object (locked ones are refused by the DB). */
export async function removeDocument(doc: Pick<DocumentRow, "id" | "storage_path">): Promise<void> {
  const { error } = await sb().from("documents").delete().eq("id", doc.id);
  if (error) throwDb(error);
  await sb().storage.from("documents").remove([doc.storage_path]);
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

/** Short-lived signed URL (private bucket); created only after RLS allowed reading the object. */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed_url", path ?? null],
    enabled: !!path,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb().storage.from("documents").createSignedUrl(path!, 300);
      if (error) throw new Error("Náhľad obrázka sa nepodarilo načítať.");
      return data.signedUrl;
    },
  });
}
