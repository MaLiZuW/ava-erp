"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import type { Json, Tables } from "@/core/supabase/database.types";
import { throwDb, type DbMessages } from "@/core/supabase/errors";
import type { Mapping, ParsedRow } from "./rows";

const sb = () => getSupabase();
/** jsonb columns that are always objects */
type JsonObject = { [key: string]: Json | undefined };

export type ImportBatch = Tables<"import_batches">;
export type ImportBatchRow = Tables<"import_batch_rows">;
export type ImportTemplate = Tables<"import_templates">;

/** Batch options: what the prices in the file are (validated again by the database). */
export interface ImportOptions {
  currency: string;
  includes_vat: boolean;
  vat_rate_pct: number | null;
  fx_rate: number | null;
  fx_date: string | null;
}
/** Template options: options + how to read the file */
export interface TemplateOptions extends Partial<ImportOptions> {
  has_header?: boolean;
  first_data_row?: number;
  encoding?: string;
  delimiter?: string;
}

export interface Candidate {
  item_id: string;
  name: string;
  reason: "supplier_code" | "ean" | "name";
  score: number;
}

export interface Summary {
  rows: number;
  create: number;
  update_cost: number;
  skip: number;
  choose: number;
  error: number;
}

const IMPORT_MESSAGES: DbMessages = {
  "23514":
    "Import nemožno vykonať: skontrolujte menu, kurz s dátumom a sadzbu DPH, alebo rozhodnite pri riadkoch „Vybrať“.",
  "42501": "Dávka je už použitá – riadky sa nedajú meniť.",
  P0002: "Dávka alebo vybraná položka už neexistuje.",
};
const ROLLBACK_MESSAGES: DbMessages = {
  "23514":
    "Dávku nemožno vrátiť: cena niektorej položky sa medzitým zmenila, položka je už použitá v balíčku alebo dávka už bola vrátená.",
  P0002: "Dávka neexistuje.",
};

function useDone() {
  const qc = useQueryClient();
  return () => {
    for (const k of ["import_batches", "import_batch_rows", "catalog_items", "activity_logs"])
      void qc.invalidateQueries({ queryKey: [k] });
  };
}

/** Suppliers with their country (the § 7 / 7a warning for foreign suppliers). */
export function useImportSuppliers() {
  return useQuery({
    queryKey: ["suppliers", "import"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("suppliers")
        .select("id, name, country")
        .eq("is_active", true)
        .order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useImportTemplates() {
  return useQuery({
    queryKey: ["import_templates"],
    queryFn: async () => {
      const { data, error } = await sb().from("import_templates").select("*").order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      name: string;
      supplier_id: string | null;
      mapping: Mapping;
      options: TemplateOptions;
    }) => {
      const { error } = await sb()
        .from("import_templates")
        .insert({
          name: v.name,
          supplier_id: v.supplier_id,
          mapping: v.mapping as unknown as JsonObject,
          options: v.options as unknown as JsonObject,
        });
      if (error) throwDb(error, { "23505": "Šablóna s týmto názvom už existuje." });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["import_templates"] }),
  });
}

export function useImportBatches() {
  return useQuery({
    queryKey: ["import_batches"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("import_batches")
        .select("*, supplier:suppliers(name)")
        .in("status", ["applied", "rolled_back"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throwDb(error);
      return (data ?? []) as (ImportBatch & { supplier: { name: string } | null })[];
    },
  });
}

export function useBatchRows(batchId: string | null) {
  return useQuery({
    queryKey: ["import_batch_rows", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("import_batch_rows")
        .select("id, row_no, parsed, errors, match, decision, chosen_item_id, action")
        .eq("batch_id", batchId!)
        .order("row_no")
        .limit(5000);
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

/** Creates the batch with its rows and runs the dry run (nothing changes in the catalog). */
export function useCreateDryRun() {
  const done = useDone();
  return useMutation({
    mutationFn: async (v: {
      supplier_id: string | null;
      file_name: string;
      options: ImportOptions;
      rows: { rowNo: number; raw: Record<string, unknown>; parsed: ParsedRow }[];
    }) => {
      const batch = await sb()
        .from("import_batches")
        .insert({
          supplier_id: v.supplier_id,
          file_name: v.file_name.slice(0, 255),
          options: v.options as unknown as JsonObject,
        })
        .select("id")
        .single();
      if (batch.error) throwDb(batch.error, IMPORT_MESSAGES);
      const id = batch.data.id;
      for (let i = 0; i < v.rows.length; i += 500) {
        const { error } = await sb()
          .from("import_batch_rows")
          .insert(
            v.rows.slice(i, i + 500).map((r) => ({
              batch_id: id,
              row_no: r.rowNo,
              raw: r.raw as unknown as JsonObject,
              parsed: r.parsed as unknown as JsonObject,
            })),
          );
        if (error) {
          await sb().from("import_batches").delete().eq("id", id); // no half batch
          throwDb(error, IMPORT_MESSAGES);
        }
      }
      const run = await sb().rpc("dry_run_import_batch", { p_batch_id: id });
      if (run.error) {
        await sb().from("import_batches").delete().eq("id", id);
        throwDb(run.error, IMPORT_MESSAGES);
      }
      return { batchId: id, summary: run.data as unknown as Summary };
    },
    onSuccess: done,
  });
}

/** The user's choice for a row, then a new dry run (summary up to date). */
export function useDecide(batchId: string) {
  const done = useDone();
  return useMutation({
    mutationFn: async (v: {
      rowId: string;
      decision: "create" | "skip" | "update" | null;
      itemId?: string | null;
    }) => {
      const { error } = await sb()
        .from("import_batch_rows")
        .update({ decision: v.decision, chosen_item_id: v.decision === "update" ? v.itemId : null })
        .eq("id", v.rowId);
      if (error) throwDb(error, IMPORT_MESSAGES);
      const run = await sb().rpc("dry_run_import_batch", { p_batch_id: batchId });
      if (run.error) throwDb(run.error, IMPORT_MESSAGES);
      return run.data as unknown as Summary;
    },
    onSuccess: done,
  });
}

export function useApplyBatch() {
  const done = useDone();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await sb().rpc("apply_import_batch", { p_batch_id: batchId });
      if (error) throwDb(error, IMPORT_MESSAGES);
      return data as unknown as Summary;
    },
    onSuccess: done,
  });
}

/** Leaves a dry run without applying it (the draft batch is deleted). */
export function useDiscardBatch() {
  const done = useDone();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await sb().from("import_batches").delete().eq("id", batchId);
      if (error) throwDb(error, IMPORT_MESSAGES);
    },
    onSuccess: done,
  });
}

export function useRollbackBatch() {
  const done = useDone();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await sb().rpc("rollback_import_batch", { p_batch_id: batchId });
      if (error) throwDb(error, ROLLBACK_MESSAGES);
      return data as unknown as { removed: number; restored: number };
    },
    onSuccess: done,
  });
}
