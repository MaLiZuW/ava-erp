"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { throwDb } from "@/core/supabase/errors";
import { getSupabase } from "@/core/supabase/client";
import type { Json, Tables } from "@/core/supabase/database.types";
import { checkLogoFile, safeFileName } from "@/core/validation";
import type { CompanyOutput, SystemSettingKey } from "./schema";

export const keys = {
  company: ["companies"] as const,
  settings: ["system_settings"] as const,
  flags: ["feature_flags"] as const,
  recipients: ["notification_recipients"] as const,
  logoUrl: (path: string | null) => ["logo_url", path] as const,
  users: ["admin_list_users"] as const,
};

const sb = () => getSupabase();

// --- company ---------------------------------------------------------------------------------
export type Company = Tables<"companies">;

export function useCompany() {
  return useQuery({
    queryKey: keys.company,
    queryFn: async () => {
      const { data, error } = await sb().from("companies").select("*").maybeSingle();
      if (error) throwDb(error);
      return data;
    },
  });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: CompanyOutput }) => {
      // the company row exists on dev (seed); on a fresh production project the first save creates it
      const res = id
        ? await sb().from("companies").update(values).eq("id", id).select().single()
        : await sb().from("companies").insert(values).select().single();
      if (res.error) throwDb(res.error);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.company });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

// --- logo ---------------------------------------------------------------------------------------
async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useLogoDocument(documentId: string | null | undefined) {
  return useQuery({
    queryKey: ["documents", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("documents")
        .select("*")
        .eq("id", documentId!)
        .maybeSingle();
      if (error) throwDb(error);
      return data;
    },
  });
}

/** Short-lived signed URL (private bucket); created only after RLS allowed reading the object. */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: keys.logoUrl(path ?? null),
    enabled: !!path,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb().storage.from("documents").createSignedUrl(path!, 300);
      if (error) throw new Error("Náhľad loga sa nepodarilo načítať.");
      return data.signedUrl;
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, file }: { companyId: string; file: File }) => {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const problem = checkLogoFile(file, head);
      if (problem) throw new Error(problem);

      const year = new Date().getFullYear();
      const objectId = crypto.randomUUID();
      const path = `${year}/companies/${companyId}/${objectId}-${safeFileName(file.name)}`;
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
          entity_table: "companies",
          entity_id: companyId,
          category: "logo",
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
      const upd = await sb()
        .from("companies")
        .update({ logo_document_id: doc.data.id })
        .eq("id", companyId);
      if (upd.error) throwDb(upd.error);
      return doc.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.company });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

// --- system settings ---------------------------------------------------------------------------------
export function useSystemSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => {
      const { data, error } = await sb().from("system_settings").select("key, value, description");
      if (error) throwDb(error);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, Json>;
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: SystemSettingKey; value: NonNullable<Json> }) => {
      const { error } = await sb()
        .from("system_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throwDb(error);
    },
    onSuccess: (_d, { key }) => {
      void qc.invalidateQueries({ queryKey: keys.settings });
      void qc.invalidateQueries({ queryKey: ["system_settings", key] });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

// --- feature flags ---------------------------------------------------------------------------------------
export function useFeatureFlags() {
  return useQuery({
    queryKey: keys.flags,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("feature_flags")
        .select("key, enabled, note")
        .order("key");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useToggleFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await sb().from("feature_flags").update({ enabled }).eq("key", key);
      if (error) throwDb(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.flags });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

// --- notification recipients -----------------------------------------------------------------------------
export function useRecipients() {
  return useQuery({
    queryKey: keys.recipients,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("notification_recipients")
        .select("id, email, event_types, is_active")
        .order("email");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useAddRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await sb().from("notification_recipients").insert({ email });
      if (error) throwDb(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.recipients });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

export function useSetRecipientActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb()
        .from("notification_recipients")
        .update({ is_active })
        .eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.recipients });
      void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

// --- change history (shared with other modules, lives in core) ---------------------------------------------
export { useAuditLog, useProfiles } from "@/core/shared-queries";
