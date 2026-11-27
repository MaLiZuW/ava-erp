"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../supabase/client";
import { throwDb } from "../supabase/errors";
import { removeDocument, uploadAttachment, type DocumentRow } from "../storage/documents";
import { defaultCategory, type CategoryRule } from "../storage/file-check";

/** Tables with attachments (D23); contacts never (D22). Same list as private.check_attachment_file. */
export type AttachmentEntity = "catalog_items" | "customers" | "suppliers" | "resources";

export interface Attachment {
  id: string;
  entity_table: string;
  entity_id: string;
  category: string;
  category_label: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: string;
  storage_path: string;
  is_locked: boolean;
  created_at: string;
  created_by_name: string | null;
}

const sb = () => getSupabase();

/** Active categories with their allowed types and limits (configuration in the DB). */
export function useAttachmentCategories() {
  return useQuery({
    queryKey: ["attachment_categories"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("attachment_categories")
        .select("code, label, allowed_mime_types, max_bytes")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throwDb(error);
      return (data ?? []).map((c): CategoryRule => ({ ...c, max_bytes: Number(c.max_bytes) }));
    },
  });
}

export function useAttachments(entityTable: AttachmentEntity, entityId: string | null) {
  return useQuery({
    queryKey: ["attachments", entityTable, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("attachments")
        .select("*")
        .eq("entity_table", entityTable)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throwDb(error);
      return (data ?? []) as Attachment[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["attachments"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
    void qc.invalidateQueries({ queryKey: ["activity_logs"] });
    void qc.invalidateQueries({ queryKey: ["catalog_items"] });
  }, [qc]);
}

export function useRemoveAttachment() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (a: Pick<Attachment, "id" | "storage_path" | "storage_provider">) =>
      removeDocument(a),
    onSuccess: done,
  });
}

export function useChangeAttachmentCategory() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await sb().from("documents").update({ category }).eq("id", id);
      if (error)
        throwDb(error, {
          "23514":
            "Kategóriu nemožno zmeniť: typ alebo veľkosť súboru do nej nepatrí, alebo je to hlavná fotka položky.",
        });
    },
    onSuccess: done,
  });
}

// --- queue: files are collected first and uploaded one by one ----------------------------------

export type QueueStatus = "waiting" | "uploading" | "done" | "error";
export interface QueueItem {
  key: string;
  file: File;
  category: string;
  status: QueueStatus;
  error?: string;
}

/**
 * Files waiting for upload. In a form of a NEW record they are uploaded only after the record is
 * saved (`run` with its id); Cancel uploads nothing. Progress is per file (Supabase gives no
 * byte progress); a failed file stays in the queue and can be uploaded again.
 */
export function useAttachmentQueue() {
  const categories = useAttachmentCategories();
  const [items, setItems] = useState<QueueItem[]>([]);
  const ref = useRef(items);
  useEffect(() => {
    ref.current = items;
  }, [items]);
  const invalidate = useInvalidate();
  const rules = useMemo(() => categories.data ?? [], [categories.data]);

  const patch = (key: string, p: Partial<QueueItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const add = useCallback(
    (files: readonly File[]) =>
      setItems((prev) => [
        ...prev,
        ...files.map((file) => ({
          key: crypto.randomUUID(),
          file,
          category: defaultCategory(file, rules),
          status: "waiting" as const,
        })),
      ]),
    [rules],
  );

  /** Uploads waiting and failed files to the record; returns the stored documents and failures. */
  const run = useCallback(
    async (
      entityTable: AttachmentEntity,
      entityId: string,
    ): Promise<{ stored: DocumentRow[]; failed: number }> => {
      const stored: DocumentRow[] = [];
      let failed = 0;
      for (const item of ref.current.filter(
        (i) => i.status === "waiting" || i.status === "error",
      )) {
        const rule = rules.find((r) => r.code === item.category);
        if (!rule) {
          patch(item.key, { status: "error", error: "Neznáma kategória." });
          failed++;
          continue;
        }
        patch(item.key, { status: "uploading", error: undefined });
        try {
          stored.push(
            await uploadAttachment({ entityTable, entityId, category: rule, file: item.file }),
          );
          patch(item.key, { status: "done" });
        } catch (e) {
          patch(item.key, { status: "error", error: e instanceof Error ? e.message : String(e) });
          failed++;
        }
      }
      if (stored.length) invalidate();
      return { stored, failed };
    },
    [rules, invalidate],
  );

  return {
    items,
    rules,
    add,
    run,
    setCategory: (key: string, category: string) => patch(key, { category }),
    remove: (key: string) => setItems((prev) => prev.filter((i) => i.key !== key)),
    clearDone: () => setItems((prev) => prev.filter((i) => i.status !== "done")),
    busy: items.some((i) => i.status === "uploading"),
    pending: items.filter((i) => i.status === "waiting" || i.status === "error").length,
  };
}

export type AttachmentQueue = ReturnType<typeof useAttachmentQueue>;
