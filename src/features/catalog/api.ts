"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocuments, useSignedUrls } from "@/core/storage/documents";
import { getSupabase } from "@/core/supabase/client";
import type { Tables } from "@/core/supabase/database.types";
import { throwDb, type DbMessages } from "@/core/supabase/errors";
import type { ComponentOutput, ItemOutput, ItemType, RateOutput, ResourceOutput } from "./schema";

const sb = () => getSupabase();

export type CatalogItem = Tables<"catalog_items">;
export type Unit = Tables<"units">;
export type LaborRole = Tables<"labor_roles">;
export type LaborRate = Tables<"labor_rates">;
export type Resource = Tables<"resources">;
export type PackageComponent = Tables<"package_components"> & {
  component: Pick<CatalogItem, "id" | "name" | "code" | "unit_code" | "default_cost_cents"> | null;
};

/** 23514 raised by the package triggers carries a hint; constraint checks have none. */
const PACKAGE_MESSAGES: DbMessages = {
  "23514": "Balíček môže obsahovať len bežné položky – nie iný balíček ani sám seba.",
  "23505": "Táto položka už v balíčku je. Zmeňte jej množstvo.",
};
const ITEM_MESSAGES: DbMessages = {
  "23505": "Položka s týmto interným kódom, kódom dodávateľa alebo EAN už existuje.",
  "23514":
    "Nákupná cena nie je úplná (kurz a dátum pri cudzej mene, sadzba DPH pri cene s DPH) alebo EAN nie je platný.",
};
const ITEM_TYPE_MESSAGES: DbMessages = {
  "23514":
    "Položku nemožno uložiť: typ nemožno zmeniť, kým má balíček komponenty alebo je položka súčasťou balíčka; alebo nákupná cena nie je úplná.",
  "23505": "Položka s týmto interným kódom, kódom dodávateľa alebo EAN už existuje.",
};

function invalidateCatalog(qc: ReturnType<typeof useQueryClient>, ...tables: string[]) {
  for (const t of tables) void qc.invalidateQueries({ queryKey: [t] });
  void qc.invalidateQueries({ queryKey: ["activity_logs"] });
}

// --- lookups (read-only) ----------------------------------------------------------------------------------
export { useDivisions } from "@/core/shared-queries";

/** Active suppliers for the "default supplier" select. */
export function useSupplierOptions() {
  return useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

/** Currencies of purchase prices (configuration: EUR, CZK, PLN – D26). */
export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("currencies")
        .select("code, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

// --- units ---------------------------------------------------------------------------------------------
export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await sb().from("units").select("*").order("code");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ isNew, code, name }: { isNew: boolean; code: string; name: string }) => {
      const res = isNew
        ? await sb().from("units").insert({ code, name })
        : await sb().from("units").update({ name }).eq("code", code);
      if (res.error) throwDb(res.error, { "23505": "Jednotka s týmto kódom už existuje." });
    },
    onSuccess: () => invalidateCatalog(qc, "units"),
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await sb().from("units").delete().eq("code", code);
      if (error)
        throwDb(error, { "23503": "Jednotka sa používa v katalógu, preto ju nemožno zmazať." });
    },
    onSuccess: () => invalidateCatalog(qc, "units"),
  });
}

// --- catalog items ---------------------------------------------------------------------------------------
export function useCatalogItems({
  type,
  showInactive,
}: {
  type: ItemType | "all";
  showInactive: boolean;
}) {
  return useQuery({
    queryKey: ["catalog_items", "list", type, showInactive],
    queryFn: async () => {
      let q = sb().from("catalog_items").select("*");
      if (type !== "all") q = q.eq("item_type", type);
      if (!showInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("name").limit(1000);
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: ItemOutput }) => {
      const res = id
        ? await sb().from("catalog_items").update(values).eq("id", id).select().single()
        : await sb().from("catalog_items").insert(values).select().single();
      if (res.error) throwDb(res.error, id ? ITEM_TYPE_MESSAGES : ITEM_MESSAGES);
      return res.data;
    },
    onSuccess: () => invalidateCatalog(qc, "catalog_items", "package_components"),
  });
}

export function useSetItemActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb().from("catalog_items").update({ is_active }).eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => invalidateCatalog(qc, "catalog_items"),
  });
}

// --- package components ---------------------------------------------------------------------------------
export function useComponents(packageId: string | null) {
  return useQuery({
    queryKey: ["package_components", packageId],
    enabled: !!packageId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("package_components")
        .select(
          "*, component:catalog_items!package_components_component_item_id_fkey(id, name, code, unit_code, default_cost_cents)",
        )
        .eq("package_item_id", packageId!);
      if (error) throwDb(error);
      return (data ?? []) as PackageComponent[];
    },
  });
}

export function useAddComponent(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: ComponentOutput) => {
      const { error } = await sb()
        .from("package_components")
        .insert({ package_item_id: packageId, ...values });
      if (error) throwDb(error, PACKAGE_MESSAGES);
    },
    onSuccess: () => invalidateCatalog(qc, "package_components"),
  });
}

export function useUpdateComponent(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ componentId, quantity }: { componentId: string; quantity: number }) => {
      const { error } = await sb()
        .from("package_components")
        .update({ quantity })
        .eq("package_item_id", packageId)
        .eq("component_item_id", componentId);
      if (error) throwDb(error, PACKAGE_MESSAGES);
    },
    onSuccess: () => invalidateCatalog(qc, "package_components"),
  });
}

export function useRemoveComponent(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (componentId: string) => {
      const { error } = await sb()
        .from("package_components")
        .delete()
        .eq("package_item_id", packageId)
        .eq("component_item_id", componentId);
      if (error) throwDb(error);
    },
    onSuccess: () => invalidateCatalog(qc, "package_components"),
  });
}

// --- labour roles and rates ---------------------------------------------------------------------------------
export function useRoles() {
  return useQuery({
    queryKey: ["labor_roles"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("labor_roles")
        .select("*")
        .order("is_active", { ascending: false })
        .order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      is_active,
    }: {
      id: string | null;
      name?: string;
      is_active?: boolean;
    }) => {
      const res = id
        ? await sb().from("labor_roles").update({ name, is_active }).eq("id", id)
        : await sb().from("labor_roles").insert({ name: name! });
      if (res.error) throwDb(res.error, { "23505": "Rola s týmto názvom už existuje." });
    },
    onSuccess: () => invalidateCatalog(qc, "labor_roles"),
  });
}

export function useRates() {
  return useQuery({
    queryKey: ["labor_rates"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("labor_rates")
        .select("*")
        .order("valid_from", { ascending: false });
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      roleId,
      values,
    }: {
      id: string | null;
      roleId: string;
      values: RateOutput;
    }) => {
      const res = id
        ? await sb().from("labor_rates").update(values).eq("id", id)
        : await sb()
            .from("labor_rates")
            .insert({ role_id: roleId, ...values });
      if (res.error)
        throwDb(res.error, {
          "23P01":
            "Obdobie platnosti sa prekrýva s inou sadzbou tejto roly. Najprv ukončite predchádzajúcu sadzbu (Platí do).",
        });
    },
    onSuccess: () => invalidateCatalog(qc, "labor_rates"),
  });
}

// --- resources ----------------------------------------------------------------------------------------------
export function useResources(showInactive: boolean) {
  return useQuery({
    queryKey: ["resources", showInactive],
    queryFn: async () => {
      let q = sb().from("resources").select("*");
      if (!showInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("name");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: ResourceOutput }) => {
      const res = id
        ? await sb().from("resources").update(values).eq("id", id).select().single()
        : await sb().from("resources").insert(values).select().single();
      if (res.error) throwDb(res.error);
      return res.data;
    },
    onSuccess: () => invalidateCatalog(qc, "resources"),
  });
}

export function useSetResourceActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb().from("resources").update({ is_active }).eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => invalidateCatalog(qc, "resources"),
  });
}

// --- main photo, thumbnails, duplicate a package (block J, owner's point 17) -----------------------------
export function useSetMainPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, documentId }: { itemId: string; documentId: string | null }) => {
      const { error } = await sb()
        .from("catalog_items")
        .update({ main_photo_document_id: documentId })
        .eq("id", itemId);
      if (error)
        throwDb(error, { "23514": "Hlavná fotka musí byť fotka priložená k tejto položke." });
    },
    onSuccess: () => invalidateCatalog(qc, "catalog_items", "attachments"),
  });
}

/** Thumbnails of the main photos: item id → signed URL (one request for the whole list). */
export function useCatalogThumbs(
  items: readonly Pick<CatalogItem, "id" | "main_photo_document_id">[],
) {
  const ids = items.map((i) => i.main_photo_document_id).filter((x): x is string => !!x);
  const docs = useDocuments(ids);
  const paths = (docs.data ?? []).map((d) => d.storage_path);
  const urls = useSignedUrls(paths);
  const byDoc = new Map((docs.data ?? []).map((d) => [d.id, urls.data?.get(d.storage_path)]));
  return new Map(
    items
      .filter((i) => i.main_photo_document_id && byDoc.get(i.main_photo_document_id))
      .map((i) => [i.id, byDoc.get(i.main_photo_document_id!)!]),
  );
}

export function useDuplicatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; name: string; code: string | null }) => {
      const { data, error } = await sb().rpc("duplicate_catalog_package", {
        p_id: v.id,
        p_name: v.name,
        p_code: v.code ?? undefined,
      });
      if (error)
        throwDb(error, {
          "23505": "Položka s týmto kódom už existuje.",
          "23514": "Názov alebo kód kópie nie je platný.",
        });
      return data as string;
    },
    onSuccess: () => invalidateCatalog(qc, "catalog_items", "package_components"),
  });
}
