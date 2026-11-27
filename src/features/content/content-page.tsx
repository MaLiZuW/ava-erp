"use client";

import { RequireRole } from "@/core/auth/require-role";
import { RecordHistoryTile } from "@/core/record-history";
import { useDivisions, useFeatureFlagMap } from "@/core/shared-queries";
import type { AuditEntry } from "@/ui/audit-timeline";
import { FormMessage } from "@/ui/field";
import { BentoGrid, Tile } from "@/ui/tile";
import { useContentBlocks } from "./api";
import { ContentBlockTile } from "./components/content-block-tile";
import { CONTENT_FIELD_LABELS, CONTENT_SLOTS } from "./schema";

function recordLabel(e: AuditEntry): string {
  const data = (e.new_data ?? e.old_data) as { title?: string; file_name?: string } | null;
  if (e.table_name === "documents") return `Obrázok: ${data?.file_name ?? ""}`;
  return `Blok: ${data?.title ?? ""}`;
}

/** Dokumenty → knižnica obsahu (texts and images the presentations are assembled from). */
function ContentLibrary() {
  const blocks = useContentBlocks();
  const divisions = useDivisions();
  const flags = useFeatureFlagMap();
  const divisionId = (code: string | null) =>
    code ? (divisions.data?.find((d) => d.code === code)?.id ?? null) : null;
  const slots = CONTENT_SLOTS.filter((s) => !s.flag || flags.data?.[s.flag] === true);

  if (blocks.isPending || divisions.isPending) {
    return (
      <BentoGrid>
        <Tile size="L" title="Knižnica obsahu">
          <div aria-hidden className="bg-canvas h-24 animate-pulse rounded-xl" />
        </Tile>
      </BentoGrid>
    );
  }
  if (blocks.error) return <FormMessage tone="error">{blocks.error.message}</FormMessage>;

  return (
    <div className="flex flex-col gap-4">
      <Tile size="HERO" title="Knižnica obsahu">
        <p className="max-w-prose text-[15px] text-neutral-700">
          Texty a obrázky, z ktorých systém skladá firemnú prezentáciu k ponuke a propagačné
          dokumenty (generovanie PDF príde vo fáze 4). Každá zmena textu zvýši verziu bloku.
          Referencie zákazníkov sem nepatria – tie budú len so súhlasom zákazníka.
        </p>
      </Tile>
      <BentoGrid className="md:auto-rows-[minmax(160px,auto)]">
        {slots.map((slot) => (
          <ContentBlockTile
            key={`${slot.key}-${blocks.data.get(slot.key)?.id ?? "new"}`}
            slot={slot}
            block={blocks.data.get(slot.key) ?? null}
            divisionId={divisionId(slot.division)}
          />
        ))}
      </BentoGrid>
      {/* change history is always the last section of the page (DESIGN_SYSTEM §1) */}
      <RecordHistoryTile
        tables={["content_blocks"]}
        fieldLabels={CONTENT_FIELD_LABELS}
        recordLabel={recordLabel}
      />
    </div>
  );
}

export function ContentPage() {
  return (
    <RequireRole role="admin">
      <ContentLibrary />
    </RequireRole>
  );
}
