import { z } from "zod";
import type { Database } from "@/core/supabase/database.types";

type JobType = Database["public"]["Enums"]["job_type"];
type DivisionCode = Database["public"]["Enums"]["division_code"];

/**
 * Slots of the content library (BUSINESS_PROCESSES.md 15, DATABASE_SCHEMA.md §18 examples):
 * texts about the company and service descriptions per job type; divisions from chapter 2.
 * SERVICE is shown only with the feature flag service_cnc.
 */
export interface ContentSlot {
  key: string;
  title: string;
  hint: string;
  division: DivisionCode | null;
  jobType: JobType | null;
  flag?: string;
}

export const CONTENT_SLOTS: readonly ContentSlot[] = [
  {
    key: "about_company",
    title: "O firme",
    hint: "Kto sme, čo robíme, prečo s nami – úvod každej prezentácie.",
    division: null,
    jobType: null,
  },
  {
    key: "service_ENG",
    title: "Inžinierske služby",
    hint: "AVENG – projekty s cieľom, míľnikmi a hodinami.",
    division: "AVENG",
    jobType: "ENG",
  },
  {
    key: "service_EVENT",
    title: "Reklama a eventy",
    hint: "Agentúra – podujatia, koordinácia dodávateľov.",
    division: "AGENCY",
    jobType: "EVENT",
  },
  {
    key: "service_PROMO",
    title: "Reklamné predmety",
    hint: "Agentúra – predmety s potlačou, schválenie vizuálu.",
    division: "AGENCY",
    jobType: "PROMO",
  },
  {
    key: "service_SEASON",
    title: "Sezónne balíčky",
    hint: "Agentúra – napr. mikulášske balíčky.",
    division: "AGENCY",
    jobType: "SEASON",
  },
  {
    key: "service_SERVICE",
    title: "Diely a servis CNC",
    hint: "Skryté – zapína sa funkciou service_cnc.",
    division: "AGENCY",
    jobType: "SERVICE",
    flag: "service_cnc",
  },
];

export const blockSchema = z.object({
  title: z.string().trim().min(1, "Zadajte nadpis.").max(200, "Najviac 200 znakov."),
  body: z.string().max(20000, "Najviac 20 000 znakov."),
});
export type BlockInput = z.infer<typeof blockSchema>;

export const MAX_IMAGES = 12;

export const CONTENT_FIELD_LABELS: Record<string, Record<string, string>> = {
  content_blocks: {
    key: "Kľúč",
    title: "Nadpis",
    body: "Text",
    image_document_ids: "Obrázky",
    version: "Verzia",
    is_active: "Aktívny",
    language: "Jazyk",
    division_id: "Divízia",
    job_type: "Typ zákazky",
  },
  documents: { file_name: "Súbor", category: "Kategória", size_bytes: "Veľkosť (B)" },
};
