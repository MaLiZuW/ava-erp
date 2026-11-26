import type { ReactNode } from "react";
import { formatMoney } from "@/core/format";
import { Button } from "./button";
import { ProcessRail } from "./process-rail";
import { StatusBadge, type StatusTone } from "./status-badge";
import { BentoGrid, Tile } from "./tile";

export interface NextStep {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface DocumentShellProps {
  number: string;
  status: { label: string; tone?: StatusTone };
  customer?: string;
  totalCents?: number | null;
  /** Exactly one primary "next step" (from status_transitions, is_primary). */
  nextStep?: NextStep;
  /** Index into the process axis. */
  processIndex?: number;
  /** Document-specific tiles. */
  children?: ReactNode;
}

/**
 * Single shell for all document detail screens (DOP, CP, ZAK, OD, DL, FA) – ARCHITECTURE_CORE.md §2.
 * Phase 1: empty skeleton; modules only fill `children`.
 */
export function DocumentShell({
  number,
  status,
  customer,
  totalCents,
  nextStep,
  processIndex,
  children,
}: DocumentShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <BentoGrid>
        <Tile size="HERO" title="Doklad">
          <div className="flex h-full flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-navy text-[32px] leading-10 font-semibold">{number}</p>
                <StatusBadge label={status.label} tone={status.tone} />
              </div>
              {customer && <p className="text-[15px] text-neutral-700">{customer}</p>}
            </div>
            <div className="flex items-center gap-6">
              {totalCents != null && (
                <p className="text-[32px] leading-10 font-semibold tabular-nums">
                  {formatMoney(totalCents)}
                </p>
              )}
              {nextStep && (
                <Button onClick={nextStep.onClick} disabled={nextStep.disabled}>
                  {nextStep.label}
                </Button>
              )}
            </div>
          </div>
        </Tile>
      </BentoGrid>
      <div className="rounded-[20px] border border-neutral-200 bg-white px-6 py-4">
        <ProcessRail current={processIndex} />
      </div>
      <BentoGrid>{children}</BentoGrid>
    </div>
  );
}
