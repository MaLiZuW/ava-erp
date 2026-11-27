"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import type { Tables } from "@/core/supabase/database.types";
import { throwDb, type DbMessages } from "@/core/supabase/errors";
import {
  PARTY_TEXT,
  type ContactOutput,
  type MachineOutput,
  type PartyKind,
  type PartyOutput,
} from "./schema";

const sb = () => getSupabase();

export type Party = Tables<"customers"> & { is_foreign?: boolean; categories?: string[] };
export type Contact = Tables<"customer_contacts"> | Tables<"supplier_contacts">;
export type Machine = Tables<"customer_machines">;

const PARTY_MESSAGES: DbMessages = {
  "23505": "Firma s týmto IČO už v zozname je. Vyhľadajte ju podľa IČO alebo názvu.",
};
const CONTACT_MESSAGES: DbMessages = {
  "23505": "Hlavný kontakt už existuje. Najprv zrušte označenie pri tom druhom.",
};

const invalidate = (qc: ReturnType<typeof useQueryClient>, kind: PartyKind) => {
  void qc.invalidateQueries({ queryKey: [kind] });
  void qc.invalidateQueries({ queryKey: [PARTY_TEXT[kind].contactsTable] });
  void qc.invalidateQueries({ queryKey: ["customer_machines"] });
  void qc.invalidateQueries({ queryKey: ["activity_logs"] });
};

/** Characters with a special meaning in a PostgREST `or=(…)` filter / LIKE pattern are removed. */
export function searchTerm(input: string): string {
  return input
    .replace(/[%_,().*\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function useParties(
  kind: PartyKind,
  { search, showInactive }: { search: string; showInactive: boolean },
) {
  const term = searchTerm(search);
  return useQuery({
    queryKey: [kind, "list", term, showInactive],
    queryFn: async () => {
      let q = sb().from(kind).select("*");
      if (!showInactive) q = q.eq("is_active", true);
      if (term) {
        const digits = term.replace(/\s/g, "");
        q = /^\d+$/.test(digits)
          ? q.like("ico", `${digits}%`)
          : q.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
      }
      const { data, error } = await q.order("name").limit(500);
      if (error) throwDb(error);
      return (data ?? []) as Party[];
    },
  });
}

export function useParty(kind: PartyKind, id: string | null) {
  return useQuery({
    queryKey: [kind, "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb().from(kind).select("*").eq("id", id!).maybeSingle();
      if (error) throwDb(error);
      return data as Party | null;
    },
  });
}

export function useSaveParty(kind: PartyKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: PartyOutput }) => {
      // categories exist only on suppliers
      const { categories, ...common } = values;
      const row = kind === "suppliers" ? { ...common, categories } : common;
      const res = id
        ? await sb().from(kind).update(row).eq("id", id).select().single()
        : await sb().from(kind).insert(row).select().single();
      if (res.error) throwDb(res.error, PARTY_MESSAGES);
      return res.data as Party;
    },
    onSuccess: () => invalidate(qc, kind),
  });
}

export function useSetPartyActive(kind: PartyKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb().from(kind).update({ is_active }).eq("id", id);
      if (error) throwDb(error);
    },
    onSuccess: () => invalidate(qc, kind),
  });
}

// --- contacts ---------------------------------------------------------------------------------------
export function useContacts(kind: PartyKind, partyId: string | null) {
  const { contactsTable, fk } = PARTY_TEXT[kind];
  return useQuery({
    queryKey: [contactsTable, partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from(contactsTable)
        .select("*")
        .filter(fk, "eq", partyId!)
        .order("is_active", { ascending: false })
        .order("is_primary", { ascending: false })
        .order("full_name");
      if (error) throwDb(error);
      return (data ?? []) as Contact[];
    },
  });
}

export function useSaveContact(kind: PartyKind, partyId: string) {
  const qc = useQueryClient();
  const { contactsTable, fk } = PARTY_TEXT[kind];
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: ContactOutput }) => {
      const res = id
        ? await sb().from(contactsTable).update(values).eq("id", id)
        : await sb()
            .from(contactsTable)
            .insert({ ...values, [fk]: partyId } as never);
      if (res.error) throwDb(res.error, CONTACT_MESSAGES);
    },
    onSuccess: () => invalidate(qc, kind),
  });
}

export function useSetContactActive(kind: PartyKind) {
  const qc = useQueryClient();
  const { contactsTable } = PARTY_TEXT[kind];
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // an inactive contact cannot stay the primary one
      const patch = is_active ? { is_active } : { is_active, is_primary: false };
      const { error } = await sb().from(contactsTable).update(patch).eq("id", id);
      if (error) throwDb(error, CONTACT_MESSAGES);
    },
    onSuccess: () => invalidate(qc, kind),
  });
}

// --- machines (customers, feature flag service_cnc) -------------------------------------------------------
export function useMachines(customerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["customer_machines", customerId],
    enabled: enabled && !!customerId,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("customer_machines")
        .select("*")
        .eq("customer_id", customerId!)
        .order("is_active", { ascending: false })
        .order("manufacturer");
      if (error) throwDb(error);
      return data ?? [];
    },
  });
}

export function useSaveMachine(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: MachineOutput }) => {
      const res = id
        ? await sb().from("customer_machines").update(values).eq("id", id)
        : await sb()
            .from("customer_machines")
            .insert({ ...values, customer_id: customerId });
      if (res.error) throwDb(res.error);
    },
    onSuccess: () => invalidate(qc, "customers"),
  });
}
