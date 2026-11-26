import { KpiNumber } from "@/ui/kpi-number";
import { EmptyState } from "@/ui/empty-state";
import { BentoGrid, Tile } from "@/ui/tile";

/**
 * Dashboard skeleton (docs/DESIGN_SYSTEM.md §6.1). Phase 1: empty tiles, no data.
 * Real figures come from views (v_open_items, v_finance_monthly) in later phases.
 */
export default function Page() {
  return (
    <BentoGrid>
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
