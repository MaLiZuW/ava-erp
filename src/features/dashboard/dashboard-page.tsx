"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/core/supabase/client";
import { throwDb } from "@/core/supabase/errors";
import { EmptyState } from "@/ui/empty-state";
import { FormMessage } from "@/ui/field";
import { KpiNumber } from "@/ui/kpi-number";
import { BentoGrid, Tile } from "@/ui/tile";

/** Counters of v_open_items (DATABASE_SCHEMA.md §13). Phase 2: zeros until the modules exist. */
export const OPEN_ITEMS = [
  { key: "new_inquiries", title: "Nové dopyty" },
  { key: "quotes_to_approve", title: "CP na schválenie" },
  { key: "visuals_waiting", title: "Čakajúce vizuály" },
  { key: "overdue_tasks", title: "Omeškané úlohy" },
  { key: "delivered_not_invoiced", title: "Dodané, nevyfakturované" },
  { key: "invoices_overdue", title: "Faktúry po splatnosti" },
] as const;

type OpenItems = Record<(typeof OPEN_ITEMS)[number]["key"], number>;

function useOpenItems() {
  return useQuery({
    queryKey: ["v_open_items"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("v_open_items").select("*").maybeSingle();
      if (error) throwDb(error);
      return data as OpenItems | null;
    },
  });
}

export function DashboardPage() {
  const open = useOpenItems();
  const value = (k: keyof OpenItems) =>
    open.isPending ? "…" : open.data ? String(open.data[k] ?? 0) : "—";

  return (
    <BentoGrid>
      {OPEN_ITEMS.map((i) => (
        <Tile key={i.key} size="S" title={i.title}>
          <KpiNumber value={value(i.key)} />
        </Tile>
      ))}
      {open.error && (
        <Tile size="M" title="Chyba">
          <FormMessage tone="error">{open.error.message}</FormMessage>
        </Tile>
      )}
      <Tile size="XL" title="Výsledok obdobia">
        <EmptyState title="Bez dát" description="Ukazovatele sa zobrazia po zavedení dokladov." />
      </Tile>
      <Tile size="L" title="Na dnes">
        <EmptyState title="Nič nečaká" />
      </Tile>
      <Tile size="S" title="Pohľadávky">
        <KpiNumber value="—" />
      </Tile>
      <Tile size="S" title="Pipeline">
        <KpiNumber value="—" />
      </Tile>
      <Tile size="S" title="Obrat 12 mes.">
        <KpiNumber value="—" />
      </Tile>
      <Tile size="S" title="Úspešnosť CP">
        <KpiNumber value="—" />
      </Tile>
    </BentoGrid>
  );
}
