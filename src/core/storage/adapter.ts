/**
 * ONE storage adapter (D23): every access to stored files – upload, signed URL, removal – goes
 * through here, so the storage can be exchanged (MIGRATION_TO_SELF_HOSTED.md) by adding another
 * implementation and a value of documents.storage_provider. Nothing else calls supabase.storage.
 */
import { getSupabase } from "../supabase/client";

export type StorageProvider = "supabase";

export interface StorageAdapter {
  /** never overwrites an existing object */
  upload(path: string, file: Blob, contentType: string): Promise<void>;
  /** short-lived link; `download` = file name for "save as" (otherwise inline, e.g. PDF in a tab) */
  signedUrl(path: string, opts?: { seconds?: number; download?: string }): Promise<string>;
  /** many links at once (thumbnails in lists) – path → URL; missing objects are left out */
  signedUrls(paths: readonly string[], seconds?: number): Promise<Map<string, string>>;
  remove(paths: readonly string[]): Promise<void>;
}

const BUCKET = "documents";

export const supabaseAdapter: StorageAdapter = {
  async upload(path, file, contentType) {
    // upsert: false – an existing object is never overwritten (also refused by storage RLS)
    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType, cacheControl: "300" });
    if (error)
      throw new Error("Nahranie súboru sa nepodarilo (typ alebo veľkosť súboru nie sú povolené).");
  },
  async signedUrl(path, { seconds = 60, download } = {}) {
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(path, seconds, download ? { download } : undefined);
    if (error || !data) throw new Error("Odkaz na súbor sa nepodarilo vytvoriť.");
    return data.signedUrl;
  },
  async signedUrls(paths, seconds = 300) {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrls([...paths], seconds);
    if (error) throw new Error("Náhľady sa nepodarilo načítať.");
    for (const r of data ?? []) if (r.path && r.signedUrl && !r.error) out.set(r.path, r.signedUrl);
    return out;
  },
  async remove(paths) {
    if (paths.length === 0) return;
    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .remove([...paths]);
    if (error) throw new Error("Súbor sa nepodarilo odstrániť z úložiska.");
  },
};

const ADAPTERS: Record<StorageProvider, StorageAdapter> = { supabase: supabaseAdapter };

/** Adapter for a document (documents.storage_provider); new uploads use the default. */
export function storageFor(provider: string | null | undefined = "supabase"): StorageAdapter {
  const a = ADAPTERS[(provider ?? "supabase") as StorageProvider];
  if (!a) throw new Error(`Neznáme úložisko súborov: ${provider}`);
  return a;
}
