"use client";

import { useMemo, useState } from "react";
import { parseRateMicro } from "@/core/calc/purchase-price";
import { formatDate, formatDateTime, parseDate, parsePercent } from "@/core/format";
import { Button } from "@/ui/button";
import { ChipGroup } from "@/ui/chips";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState } from "@/ui/empty-state";
import { Checkbox, Field, FormMessage, Input, Select } from "@/ui/field";
import { DateInput, PercentInput } from "@/ui/inputs";
import { StatusBadge, type StatusTone } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { ForeignSupplierNotice } from "@/core/foreign-supplier-notice";
import { useCurrencies, useUnits } from "../api";
import {
  useApplyBatch,
  useBatchRows,
  useCreateDryRun,
  useDecide,
  useDiscardBatch,
  useImportBatches,
  useImportSuppliers,
  useImportTemplates,
  useRollbackBatch,
  useSaveTemplate,
  type Candidate,
  type ImportOptions,
  type Summary,
  type TemplateOptions,
} from "./api";
import { MAX_ROWS, readTable, type Delimiter, type Encoding, type Sheet } from "./file";
import {
  columnLabels,
  dataRows,
  EMPTY_MAPPING,
  guessMapping,
  markDuplicates,
  TARGETS,
  toParsedRow,
  type Mapping,
  type ParsedRow,
} from "./rows";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = ["Súbor", "Stĺpce", "Náhľad", "Skúšobný beh", "Hotovo"];

/** "12,50 CZK" – amounts of the price list are in its currency. */
export const formatAmount = (cents: number | string | null | undefined, currency: string) =>
  cents == null || cents === ""
    ? "—"
    : `${(Number(cents) / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const ACTION: Record<string, { label: string; tone: StatusTone }> = {
  create: { label: "Nová položka", tone: "success" },
  update_cost: { label: "Aktualizovať cenu", tone: "info" },
  skip: { label: "Preskočiť", tone: "neutral" },
  choose: { label: "Vybrať", tone: "warning" },
  error: { label: "Chyba", tone: "danger" },
};
const REASON: Record<Candidate["reason"], string> = {
  supplier_code: "kód dodávateľa",
  ean: "EAN",
  name: "podobný názov",
};

function StepHeader({ step }: { step: Step }) {
  return (
    <ol aria-label="Kroky importu" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i + 1 === step ? "step" : undefined}
          className={i + 1 === step ? "text-navy font-semibold" : "text-neutral-500"}
        >
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

interface FileState {
  name: string;
  sheet: Sheet;
  encoding?: string;
  delimiter?: string;
}

/** Katalóg → Import: price list XLSX / CSV → mapping → preview → dry run → batch (D26). */
export function ImportTab() {
  const units = useUnits();
  const currencies = useCurrencies();
  const suppliers = useImportSuppliers();
  const templates = useImportTemplates();
  const saveTemplate = useSaveTemplate();
  const createDryRun = useCreateDryRun();
  const apply = useApplyBatch();
  const discard = useDiscardBatch();

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<Encoding>("auto");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const [supplierId, setSupplierId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [includesVat, setIncludesVat] = useState(false);
  const [vat, setVat] = useState("");
  const [rate, setRate] = useState("");
  const [rateDate, setRateDate] = useState("");
  const [loaded, setLoaded] = useState<FileState | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [firstRow, setFirstRow] = useState("2");
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [templateName, setTemplateName] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const supplier = suppliers.data?.find((s) => s.id === supplierId);
  const unitSet = useMemo(() => new Set((units.data ?? []).map((u) => u.code)), [units.data]);

  /** Options of the batch – checked here, again by the database. */
  const options = (): ImportOptions | string => {
    let vatPct: number | null = null;
    if (includesVat) {
      vatPct = parsePercent(vat);
      if (vatPct == null || vatPct < 0 || vatPct > 100) return "Zadajte sadzbu DPH (0–100 %).";
    }
    let fx: number | null = null;
    let fxDate: string | null = null;
    if (currency !== "EUR") {
      const micro = parseRateMicro(rate);
      if (micro == null) return `Zadajte kurz – koľko ${currency} je 1 EUR (napr. 25,125).`;
      fx = Number(micro) / 1_000_000;
      fxDate = parseDate(rateDate);
      if (!fxDate) return "Zadajte dátum kurzu (DD/MM/YYYY).";
    }
    return {
      currency,
      includes_vat: includesVat,
      vat_rate_pct: vatPct,
      fx_rate: fx,
      fx_date: fxDate,
    };
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.data?.find((x) => x.id === id);
    if (!t) return;
    const o = t.options as TemplateOptions;
    if (t.supplier_id) setSupplierId(t.supplier_id);
    if (o.currency) setCurrency(o.currency);
    setIncludesVat(!!o.includes_vat);
    setVat(o.vat_rate_pct == null ? "" : String(o.vat_rate_pct).replace(".", ","));
    if (o.encoding) setEncoding(o.encoding as Encoding);
    if (o.delimiter) setDelimiter(o.delimiter as Delimiter);
    if (o.has_header != null) setHasHeader(o.has_header);
    if (o.first_data_row) setFirstRow(String(o.first_data_row));
    setMapping({ ...EMPTY_MAPPING, ...(t.mapping as Partial<Mapping>) });
  };

  const load = async () => {
    setProblem(null);
    if (!file) return setProblem("Vyberte súbor cenníka (XLSX alebo CSV).");
    const o = options();
    if (typeof o === "string") return setProblem(o);
    try {
      const t = await readTable(file, { encoding, delimiter });
      if (t.rows.length === 0) return setProblem("Súbor neobsahuje žiadne riadky.");
      if (t.rows.length > MAX_ROWS + 1)
        return setProblem(`Súbor má viac ako ${MAX_ROWS} riadkov – rozdeľte ho na menšie časti.`);
      setLoaded({ name: file.name, sheet: t.rows, encoding: t.encoding, delimiter: t.delimiter });
      // a template keeps its mapping; otherwise it is guessed from the header
      if (!templateId) setMapping(guessMapping(t.rows[0] ?? []));
      setStep(2);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const first = Math.max(1, Number.parseInt(firstRow, 10) || (hasHeader ? 2 : 1));
  const preview = useMemo(() => {
    if (!loaded) return [];
    const rows = dataRows(loaded.sheet, first).map((r) => ({
      rowNo: r.rowNo,
      cells: r.cells,
      ...toParsedRow(r.cells, mapping, { units: unitSet }),
    }));
    markDuplicates(rows);
    return rows;
  }, [loaded, first, mapping, unitSet]);
  const errorCount = preview.filter((r) => r.errors.length > 0).length;
  const labels = loaded ? columnLabels(loaded.sheet, hasHeader) : [];

  const toPreview = () => {
    setProblem(null);
    const missing = TARGETS.filter((t) => t.required && mapping[t.key] == null).map((t) => t.label);
    if (missing.length) return setProblem(`Priraďte stĺpec pre: ${missing.join(", ")}.`);
    if (preview.length === 0) return setProblem("Od zvoleného riadku nie sú žiadne dáta.");
    setStep(3);
  };

  const runDry = async () => {
    setProblem(null);
    const o = options();
    if (typeof o === "string") return setProblem(o);
    const res = await createDryRun
      .mutateAsync({
        supplier_id: supplierId || null,
        file_name: loaded!.name,
        options: o,
        rows: preview.map((r) => ({
          rowNo: r.rowNo,
          raw: Object.fromEntries(
            r.cells.map((c, i) => [
              labels[i] ?? String(i),
              c instanceof Date ? c.toISOString() : c,
            ]),
          ),
          parsed: r.parsed as ParsedRow,
        })),
      })
      .catch(() => null);
    if (!res) return;
    setBatchId(res.batchId);
    setSummary(res.summary);
    setStep(4);
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setLoaded(null);
    setBatchId(null);
    setSummary(null);
    setTemplateId("");
    setProblem(null);
    createDryRun.reset();
    apply.reset();
  };

  const error =
    problem ?? createDryRun.error?.message ?? apply.error?.message ?? discard.error?.message;

  return (
    <>
      <Tile size="XL" title="Import cenníka (XLSX / CSV)">
        <div className="flex flex-col gap-4">
          <StepHeader step={step} />

          {step === 1 && (
            <section aria-label="Súbor" className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  id="import-file"
                  label="Súbor cenníka"
                  hint="XLSX alebo CSV, najviac 5 000 riadkov."
                  className="md:col-span-2"
                >
                  <Input
                    id="import-file"
                    type="file"
                    accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                <Field id="import-encoding" label="Kódovanie (CSV)">
                  <Select
                    id="import-encoding"
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value as Encoding)}
                  >
                    <option value="auto">Automaticky</option>
                    <option value="utf-8">UTF-8</option>
                    <option value="windows-1250">Windows-1250 (Excel)</option>
                  </Select>
                </Field>
                <Field id="import-delimiter" label="Oddeľovač (CSV)">
                  <Select
                    id="import-delimiter"
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value as Delimiter)}
                  >
                    <option value="auto">Automaticky</option>
                    <option value=";">Bodkočiarka ;</option>
                    <option value=",">Čiarka ,</option>
                    <option value={"\t"}>Tabulátor</option>
                  </Select>
                </Field>
                <Field
                  id="import-supplier"
                  label="Dodávateľ"
                  hint="Nové položky dostanú tohto dodávateľa."
                  className="md:col-span-2"
                >
                  <Select
                    id="import-supplier"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">— bez dodávateľa —</option>
                    {(suppliers.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="import-template" label="Šablóna mapovania" className="md:col-span-2">
                  <Select
                    id="import-template"
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">— bez šablóny (odhad podľa hlavičky) —</option>
                    {(templates.data ?? [])
                      .filter((t) => !supplierId || !t.supplier_id || t.supplier_id === supplierId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field id="import-currency" label="Mena cien v súbore">
                  <Select
                    id="import-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {(currencies.data ?? [{ code: "EUR", name: "euro" }]).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} – {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex flex-col justify-end">
                  <Checkbox
                    label="Ceny sú s DPH"
                    checked={includesVat}
                    onChange={(e) => setIncludesVat(e.target.checked)}
                  />
                </div>
                {includesVat && (
                  <Field
                    id="import-vat"
                    label="Sadzba DPH %"
                    hint="Podľa cenníka (napr. 21 v CZ, 23 v SK)."
                  >
                    <PercentInput
                      id="import-vat"
                      value={vat}
                      onChange={(e) => setVat(e.target.value)}
                    />
                  </Field>
                )}
                {currency !== "EUR" && (
                  <>
                    <Field
                      id="import-rate"
                      label={`Kurz (${currency} za 1 EUR)`}
                      hint="Ako kurzový lístok ECB / NBS."
                    >
                      <Input
                        id="import-rate"
                        inputMode="decimal"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                      />
                    </Field>
                    <Field id="import-rate-date" label="Dátum kurzu">
                      <DateInput
                        id="import-rate-date"
                        value={rateDate}
                        onChange={(e) => setRateDate(e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </div>
              {supplier && supplier.country !== "SK" && <ForeignSupplierNotice />}
              <p className="text-[13px] text-neutral-500">
                V katalógu sa uloží cena v EUR bez DPH a pri nej pôvodná cena, mena, kurz a dátum.
                Vystavené cenové ponuky sa nezmenia.
              </p>
              <div>
                <Button onClick={() => void load()}>Načítať súbor</Button>
              </div>
            </section>
          )}

          {step === 2 && loaded && (
            <section aria-label="Stĺpce" className="flex flex-col gap-4">
              <p className="text-[15px]">
                <strong>{loaded.name}</strong> · {loaded.sheet.length} riadkov
                {loaded.encoding &&
                  ` · ${loaded.encoding === "windows-1250" ? "Windows-1250" : "UTF-8"}`}
                {loaded.delimiter &&
                  ` · oddeľovač ${loaded.delimiter === "\t" ? "tabulátor" : `„${loaded.delimiter}“`}`}
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <Checkbox
                  label="Prvý riadok obsahuje názvy stĺpcov"
                  checked={hasHeader}
                  onChange={(e) => {
                    setHasHeader(e.target.checked);
                    setFirstRow(e.target.checked ? "2" : "1");
                  }}
                />
                <Field id="import-first-row" label="Dáta začínajú riadkom" className="w-40">
                  <Input
                    id="import-first-row"
                    inputMode="numeric"
                    value={firstRow}
                    onChange={(e) => setFirstRow(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {TARGETS.map((t) => (
                  <Field
                    key={t.key}
                    id={`map-${t.key}`}
                    label={`${t.label}${t.required ? " *" : ""}`}
                  >
                    <Select
                      id={`map-${t.key}`}
                      value={mapping[t.key] == null ? "" : String(mapping[t.key])}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [t.key]: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">— nenačítať —</option>
                      {labels.map((l, i) => (
                        <option key={l} value={i}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              <p className="text-[13px] text-neutral-500">
                Bez stĺpca Jednotka sa použije „ks“, bez stĺpca Typ „Materiál / tovar“.
              </p>
              <div className="flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-4">
                <Field id="template-name" label="Uložiť ako šablónu" className="min-w-64">
                  <Input
                    id="template-name"
                    placeholder={supplier ? `Cenník ${supplier.name}` : "Názov šablóny"}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </Field>
                <Button
                  variant="secondary"
                  disabled={!templateName.trim() || saveTemplate.isPending}
                  onClick={() => {
                    const o = options();
                    saveTemplate.mutate({
                      name: templateName.trim(),
                      supplier_id: supplierId || null,
                      mapping,
                      options: {
                        ...(typeof o === "string" ? {} : o),
                        has_header: hasHeader,
                        first_data_row: first,
                        encoding,
                        delimiter,
                      },
                    });
                  }}
                >
                  Uložiť šablónu
                </Button>
                {saveTemplate.isSuccess && (
                  <FormMessage tone="success">Šablóna je uložená.</FormMessage>
                )}
                {saveTemplate.error && (
                  <FormMessage tone="error">{saveTemplate.error.message}</FormMessage>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={toPreview}>Zobraziť náhľad</Button>
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Späť
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-label="Náhľad" className="flex flex-col gap-4">
              <p className="text-[15px]" data-testid="import-preview-count">
                {preview.length} riadkov · {errorCount} s chybou
                {errorCount > 0 && " – riadky s chybou sa neimportujú"}
              </p>
              <ChipGroup
                label="Zobraziť riadky"
                options={[
                  { value: "all", label: "Všetky" },
                  { value: "errors", label: "S chybou" },
                ]}
                value={onlyErrors ? "errors" : "all"}
                onChange={(v) => setOnlyErrors(v === "errors")}
              />
              <PreviewTable
                rows={preview.filter((r) => !onlyErrors || r.errors.length > 0).slice(0, 200)}
                currency={currency}
              />
              <div className="flex gap-2">
                <Button onClick={() => void runDry()} disabled={createDryRun.isPending}>
                  {createDryRun.isPending ? "Spracúvam…" : "Skúšobný beh"}
                </Button>
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Späť
                </Button>
              </div>
              <p className="text-[13px] text-neutral-500">Skúšobný beh v katalógu nič nezmení.</p>
            </section>
          )}

          {step === 4 && batchId && summary && (
            <DryRun
              batchId={batchId}
              summary={summary}
              currency={currency}
              onSummary={setSummary}
              onApply={() => setConfirmApply(true)}
              onDiscard={() => discard.mutate(batchId, { onSuccess: reset })}
              busy={apply.isPending || discard.isPending}
            />
          )}

          {step === 5 && summary && (
            <section aria-label="Hotovo" className="flex flex-col gap-3" data-testid="import-done">
              <FormMessage tone="success">
                Import je hotový: {summary.create} nových položiek, {summary.update_cost}{" "}
                aktualizovaných cien, {summary.skip} preskočených, {summary.error} chybných riadkov.
              </FormMessage>
              <p className="text-[13px] text-neutral-700">
                Dávku môžete vrátiť v zozname nižšie, kým sa jej položky nepoužijú.
              </p>
              <div>
                <Button onClick={reset}>Nový import</Button>
              </div>
            </section>
          )}

          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
      </Tile>
      <ConfirmDialog
        open={confirmApply}
        title="Potvrdiť import?"
        confirmLabel="Importovať"
        busy={apply.isPending}
        onCancel={() => setConfirmApply(false)}
        onConfirm={() =>
          apply.mutate(batchId!, {
            onSuccess: (s) => {
              setSummary(s);
              setStep(5);
            },
            onSettled: () => setConfirmApply(false),
          })
        }
      >
        Vytvorí sa {summary?.create ?? 0} nových položiek a aktualizuje {summary?.update_cost ?? 0}{" "}
        nákupných cien. Dávku bude možné vrátiť.
      </ConfirmDialog>
      <BatchesTile />
    </>
  );
}

function PreviewTable({
  rows,
  currency,
}: {
  rows: { rowNo: number; parsed: ParsedRow; errors: string[] }[];
  currency: string;
}) {
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full border-collapse text-[15px]">
        <caption className="sr-only">Náhľad importu</caption>
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-neutral-200 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            <th scope="col" className="h-10 pr-3">
              Riadok
            </th>
            <th scope="col" className="px-3">
              Názov
            </th>
            <th scope="col" className="px-3">
              Kód / EAN
            </th>
            <th scope="col" className="px-3 text-right">
              Cena
            </th>
            <th scope="col" className="px-3">
              Jedn.
            </th>
            <th scope="col" className="px-3">
              Chyby
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.rowNo}
              className="border-b border-neutral-200 align-top"
              data-testid="preview-row"
            >
              <td className="py-2 pr-3 tabular-nums">{r.rowNo}</td>
              <td className="px-3 py-2">{r.parsed.name || "—"}</td>
              <td className="px-3 py-2 text-[13px] tabular-nums">
                {[r.parsed.supplier_item_code, r.parsed.ean].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatAmount(r.parsed.price, currency)}
              </td>
              <td className="px-3 py-2">{r.parsed.unit_code}</td>
              <td className="text-danger px-3 py-2 text-[13px]">{r.errors.join(" ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Step 4: result of the matching per row; decisions for "Vybrať"; then "Potvrdiť import". */
function DryRun({
  batchId,
  summary,
  currency,
  onSummary,
  onApply,
  onDiscard,
  busy,
}: {
  batchId: string;
  summary: Summary;
  currency: string;
  onSummary: (s: Summary) => void;
  onApply: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  const rows = useBatchRows(batchId);
  const decide = useDecide(batchId);
  const [filter, setFilter] = useState<string>("all");
  const shown = (rows.data ?? [])
    .filter((r) => filter === "all" || r.action === filter)
    .slice(0, 300);
  const counts: [string, number][] = [
    ["create", summary.create],
    ["update_cost", summary.update_cost],
    ["choose", summary.choose],
    ["skip", summary.skip],
    ["error", summary.error],
  ];

  return (
    <section aria-label="Skúšobný beh" className="flex flex-col gap-4">
      <ul
        className="flex flex-wrap gap-2"
        aria-label="Súhrn skúšobného behu"
        data-testid="dry-run-summary"
      >
        {counts.map(([k, n]) => (
          <li key={k}>
            <StatusBadge
              label={`${ACTION[k].label}: ${n}`}
              tone={n > 0 ? ACTION[k].tone : "neutral"}
            />
          </li>
        ))}
      </ul>
      <ChipGroup
        label="Zobraziť riadky"
        options={[
          { value: "all", label: "Všetky" },
          ...counts.map(([k]) => ({ value: k, label: ACTION[k].label })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      {rows.isPending ? (
        <div aria-hidden className="bg-canvas h-24 animate-pulse rounded-xl" />
      ) : shown.length === 0 ? (
        <EmptyState title="Žiadne riadky" />
      ) : (
        <ul
          className="flex max-h-[520px] flex-col divide-y divide-neutral-200 overflow-auto"
          aria-label="Riadky dávky"
        >
          {shown.map((r) => {
            const p = r.parsed as unknown as ParsedRow;
            const cands = (r.match as unknown as Candidate[]) ?? [];
            const errors = (r.errors as unknown as string[]) ?? [];
            const value =
              r.decision === "update"
                ? `item:${r.chosen_item_id}`
                : r.decision
                  ? r.decision
                  : "auto";
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                data-testid="dry-run-row"
              >
                <span className="w-10 text-[13px] text-neutral-500 tabular-nums">{r.row_no}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name || "—"}</p>
                  <p className="text-[13px] text-neutral-500 tabular-nums">
                    {formatAmount(p.price, currency)}
                    {r.action === "update_cost" &&
                      cands[0] &&
                      ` → ${cands.find((c) => c.item_id === r.chosen_item_id)?.name ?? cands[0].name}`}
                    {errors.length > 0 && (
                      <span className="text-danger"> · {errors.join(" ")}</span>
                    )}
                  </p>
                </div>
                <StatusBadge
                  label={ACTION[r.action ?? "error"].label}
                  tone={ACTION[r.action ?? "error"].tone}
                />
                {r.action !== "error" && (
                  <Select
                    aria-label={`Rozhodnutie – riadok ${r.row_no}`}
                    className="h-8 w-64 text-[13px]"
                    value={value}
                    disabled={decide.isPending || busy}
                    onChange={(e) => {
                      const v = e.target.value;
                      decide.mutate(
                        v.startsWith("item:")
                          ? { rowId: r.id, decision: "update", itemId: v.slice(5) }
                          : {
                              rowId: r.id,
                              decision: v === "auto" ? null : (v as "create" | "skip"),
                            },
                        { onSuccess: onSummary },
                      );
                    }}
                  >
                    <option value="auto">
                      {r.action === "choose" ? "Vyberte…" : "Automaticky"}
                    </option>
                    {cands.map((c) => (
                      <option key={c.item_id} value={`item:${c.item_id}`}>
                        Aktualizovať: {c.name} ({REASON[c.reason]}
                        {c.reason === "name" ? ` ${String(c.score).replace(".", ",")}` : ""})
                      </option>
                    ))}
                    <option value="create">Založiť novú položku</option>
                    <option value="skip">Preskočiť</option>
                  </Select>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {decide.error && <FormMessage tone="error">{decide.error.message}</FormMessage>}
      {summary.choose > 0 && (
        <FormMessage tone="error">
          {summary.choose} {summary.choose === 1 ? "riadok čaká" : "riadky čakajú"} na rozhodnutie
          („Vybrať“).
        </FormMessage>
      )}
      <div className="flex gap-2">
        <Button
          onClick={onApply}
          disabled={busy || summary.choose > 0 || summary.create + summary.update_cost === 0}
        >
          Potvrdiť import
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          Zrušiť skúšobný beh
        </Button>
      </div>
    </section>
  );
}

/** Applied batches with "Vrátiť dávku". */
function BatchesTile() {
  const batches = useImportBatches();
  const rollback = useRollbackBatch();
  const [confirm, setConfirm] = useState<string | null>(null);
  const target = batches.data?.find((b) => b.id === confirm);
  return (
    <Tile size="XL" title="Dávky importu">
      {batches.error && <FormMessage tone="error">{batches.error.message}</FormMessage>}
      {rollback.error && <FormMessage tone="error">{rollback.error.message}</FormMessage>}
      {batches.data?.length === 0 ? (
        <EmptyState title="Zatiaľ žiadny import" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200" aria-label="Dávky importu">
          {(batches.data ?? []).map((b) => {
            const s = b.summary as unknown as Partial<Summary>;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                data-testid="import-batch"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.file_name}</p>
                  <p className="text-[13px] text-neutral-500">
                    {formatDateTime(b.applied_at ?? b.created_at)}
                    {b.supplier && ` · ${b.supplier.name}`} · nové {s.create ?? 0} · ceny{" "}
                    {s.update_cost ?? 0}
                    {b.rolled_back_at && ` · vrátená ${formatDate(b.rolled_back_at)}`}
                  </p>
                </div>
                <StatusBadge
                  label={b.status === "applied" ? "Použitá" : "Vrátená"}
                  tone={b.status === "applied" ? "success" : "neutral"}
                />
                {b.status === "applied" && (
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-[13px]"
                    onClick={() => setConfirm(b.id)}
                  >
                    Vrátiť dávku
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Vrátiť dávku – ${target?.file_name ?? ""}?`}
        confirmLabel="Vrátiť dávku"
        busy={rollback.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && rollback.mutate(confirm, { onSettled: () => setConfirm(null) })}
      >
        Položky založené touto dávkou sa zmažú a aktualizované nákupné ceny sa vrátia na
        predchádzajúce. Nedá sa, ak sa cena medzitým zmenila alebo je položka už v balíčku.
      </ConfirmDialog>
    </Tile>
  );
}
