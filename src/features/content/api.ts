"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeDocument, uploadImageDocument, type DocumentRow } from "@/core/documents";
import { getSupabase } from "@/core/supabase/client";
import type { Tables } from "@/core/supabase/database.types";
import { throwDb } from "@/core/supabase/errors";
import { MAX_IMAGES, type BlockInput, type ContentSlot } from "./schema";

const sb = () => getSupabase();

export type ContentBlock = Tables<"content_blocks">;

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["content_blocks"] });
  void qc.invalidateQueries({ queryKey: ["documents"] });
  void qc.invalidateQueries({ queryKey: ["activity_logs"] });
}

/** Slovak blocks by key. */
export function useContentBlocks() {
  return useQuery({
    queryKey: ["content_blocks", "sk"],
    queryFn: async () => {
      const { data, error } = await sb().from("content_blocks").select("*").eq("language", "sk");
      if (error) throwDb(error);
      return new Map((data ?? []).map((b) => [b.key, b]));
    },
  });
}

/** Creates the block of a slot on the first save, then updates it. */
export function useSaveBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slot,
      block,
      values,
      divisionId,
    }: {
      slot: ContentSlot;
      block: ContentBlock | null;
      values: BlockInput;
      divisionId: string | null;
    }) => {
      const res = block
        ? await sb().from("content_blocks").update(values).eq("id", block.id).select().single()
        : await sb()
            .from("content_blocks")
            .insert({ key: slot.key, job_type: slot.jobType, division_id: divisionId, ...values })
            .select()
            .single();
      if (res.error) throwDb(res.error);
      return res.data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useAddImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ block, file }: { block: ContentBlock; file: File }) => {
      if (block.image_document_ids.length >= MAX_IMAGES) {
        throw new Error(`Blok môže mať najviac ${MAX_IMAGES} obrázkov.`);
      }
      const doc = await uploadImageDocument({
        entityTable: "content_blocks",
        entityId: block.id,
        category: "content_image",
        file,
      });
      const { error } = await sb()
        .from("content_blocks")
        .update({ image_document_ids: [...block.image_document_ids, doc.id] })
        .eq("id", block.id);
      if (error) {
        await removeDocument(doc); // keep storage and table consistent
        throwDb(error);
      }
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ block, doc }: { block: ContentBlock; doc: DocumentRow }) => {
      const { error } = await sb()
        .from("content_blocks")
        .update({ image_document_ids: block.image_document_ids.filter((id) => id !== doc.id) })
        .eq("id", block.id);
      if (error) throwDb(error);
      await removeDocument(doc);
    },
    onSuccess: () => invalidate(qc),
  });
}
