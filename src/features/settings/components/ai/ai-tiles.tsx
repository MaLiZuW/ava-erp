"use client";

import { ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAiBudget, useAiKeyStatus, type AiBudgetState } from "@/core/ai";
import { formatDateTime, parseDecimal } from "@/core/format";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState } from "@/ui/empty-state";
import { Field, FormMessage, Input, Select } from "@/ui/field";
import { KpiNumber } from "@/ui/kpi-number";
import { StatusBadge, type StatusTone } from "@/ui/status-badge";
import { SettingsTile } from "../settings-tile";
import { useFeatureFlags, useToggleFlag } from "../../api";
import {
  AI_PURPOSES,
  FEATURE_LABELS,
  useAiModelPrices,
  useAiSettings,
  useAiUsage,
  useDeleteAiKey,
  useDeleteModelPrice,
  useSaveAiSettings,
  useSaveModelPrice,
  useSetAiKey,
  useTestAi,
} from "../../ai-api";

/** "0,1000 €" – prices and costs of AI are small numbers */
export const formatEur = (n: number, decimals = 2) =>
  `${n.toLocaleString("sk-SK", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;

const BUDGET: Record<AiBudgetState, { label: string; tone: StatusTone }> = {
  ok: { label: "V poriadku", tone: "success" },
  warn50: { label: "Minutá polovica rozpočtu", tone: "warning" },
  warn90: { label: "Minutých 90 % rozpočtu", tone: "danger" },
  blocked: { label: "AI vypnutá – rozpočet vyčerpaný", tone: "danger" },
};

/** Personal data and the key never go to chat or AI (shown on top of the page). */
export function AiNotice() {
  return (
    <p
      role="note"
      className="border-warning/40 text-warning flex items-start gap-2 rounded-xl border px-3 py-2 text-[15px] font-medium"
    >
      <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>
        Nenahrávajte do AI osobné údaje. API kľúč zadávajte len tu – nikdy do chatu ani e-mailu. AI
        vždy len navrhuje, potvrdzuje človek.
      </span>
    </p>
  );
}

export function AiKeyTile() {
  const status = useAiKeyStatus();
  const setKey = useSetAiKey();
  const del = useDeleteAiKey();
  const test = useTestAi();
  const [key, setKeyText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const s = status.data;
  const FORM = "ai-key-form";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setKeyText(""); // the field is cleared at once – the key is never shown back
    setKey.mutate(key.trim());
  };

  return (
    <SettingsTile
      size="XL"
      title="API kľúč"
      action={
        <Button type="submit" form={FORM} disabled={!key.trim() || setKey.isPending}>
          {setKey.isPending ? "Ukladám…" : s?.is_set ? "Vymeniť kľúč" : "Uložiť kľúč"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[15px]" data-testid="ai-key-status">
          {status.isPending ? (
            "Načítavam…"
          ) : s?.is_set ? (
            <>
              <StatusBadge label="Kľúč nastavený" tone="success" /> · končí na …{s.last4} ·{" "}
              {formatDateTime(s.set_at)}
              {s.set_by_name && ` · ${s.set_by_name}`}
            </>
          ) : (
            <StatusBadge label="Kľúč nie je nastavený" tone="warning" />
          )}
        </p>
        <form id={FORM} onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field
            id="ai-key"
            label={s?.is_set ? "Nový API kľúč (nahradí súčasný)" : "API kľúč (Google AI Studio)"}
            hint="Len na zápis: uloží sa do trezoru (Vault) a už sa nikdy nezobrazí."
            className="min-w-72 flex-1"
          >
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKeyText(e.target.value)}
            />
          </Field>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!s?.is_set || test.isPending}
            onClick={() => test.mutate()}
          >
            {test.isPending ? "Testujem…" : "Otestovať spojenie"}
          </Button>
          {s?.is_set && (
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              Odstrániť kľúč
            </Button>
          )}
        </div>
        {setKey.isSuccess && (
          <FormMessage tone="success">Kľúč je uložený (…{setKey.data.last4}).</FormMessage>
        )}
        {test.isSuccess && (
          <FormMessage tone="success">
            Spojenie funguje – model {test.data.model} odpovedal „{test.data.answer.trim()}“ (
            {formatEur(test.data.cost_eur, 6)}).
          </FormMessage>
        )}
        {(setKey.error || del.error || test.error || status.error) && (
          <FormMessage tone="error">
            {(setKey.error ?? del.error ?? test.error ?? status.error)?.message}
          </FormMessage>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Odstrániť API kľúč?"
        confirmLabel="Odstrániť"
        busy={del.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => del.mutate(undefined, { onSettled: () => setConfirm(false) })}
      >
        Kľúč sa zmaže z trezoru. AI funkcie sa zašednú, kým nezadáte nový. Ručná práca funguje
        ďalej.
      </ConfirmDialog>
    </SettingsTile>
  );
}

export function AiModelsTile() {
  const settings = useAiSettings();
  const save = useSaveAiSettings();
  const prices = useAiModelPrices();
  const savePrice = useSaveModelPrice();
  const delPrice = useDeleteModelPrice();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [price, setPrice] = useState({ model: "", input: "", output: "" });
  const [problem, setProblem] = useState<string | null>(null);
  const models = draft ?? settings.data?.models ?? {};
  const FORM = "ai-models-form";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate([{ key: "ai_models", value: models }], { onSuccess: () => setDraft(null) });
  };
  const addPrice = () => {
    setProblem(null);
    const input = parseDecimal(price.input, 4);
    const output = parseDecimal(price.output, 4);
    if (!price.model.trim()) return setProblem("Zadajte názov modelu.");
    if (input == null || output == null || input < 0 || output < 0)
      return setProblem("Ceny zadajte v EUR za 1 milión tokenov (napr. 0,10).");
    savePrice.mutate(
      { model: price.model.trim(), input, output },
      { onSuccess: () => setPrice({ model: "", input: "", output: "" }) },
    );
  };
  const priced = new Set((prices.data ?? []).map((p) => p.model));

  return (
    <SettingsTile
      size="XL"
      title="Poskytovateľ a modely"
      action={
        <Button
          type="submit"
          form={FORM}
          variant="secondary"
          disabled={draft === null || save.isPending}
        >
          Uložiť modely
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <form id={FORM} onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field id="ai-provider" label="Poskytovateľ">
            <Select id="ai-provider" value={settings.data?.provider ?? "gemini"} disabled>
              <option value="gemini">Google Gemini</option>
            </Select>
          </Field>
          {AI_PURPOSES.map((p) => {
            const value = models[p.key] ?? "";
            return (
              <Field
                key={p.key}
                id={`ai-model-${p.key}`}
                label={`Model – ${p.label}`}
                hint={
                  value && !priced.has(value)
                    ? "Chýba cena tohto modelu – AI ho nepoužije."
                    : undefined
                }
              >
                <Input
                  id={`ai-model-${p.key}`}
                  spellCheck={false}
                  placeholder="názov z Google AI Studio"
                  value={value}
                  onChange={(e) => setDraft({ ...models, [p.key]: e.target.value.trim() })}
                />
              </Field>
            );
          })}
        </form>
        <p className="text-[13px] text-neutral-500">
          Názov modelu a jeho cenu skopírujte z Google AI Studio (cenník Gemini API). Systém žiadny
          model nevyberá sám.
        </p>
        <section
          aria-label="Ceny modelov"
          className="flex flex-col gap-3 border-t border-neutral-200 pt-4"
        >
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            Ceny modelov (EUR za 1 milión tokenov)
          </h3>
          {prices.data?.length === 0 ? (
            <p className="text-[15px] text-neutral-700">
              Zatiaľ žiadna cena – bez ceny sa AI nevolá.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200">
              {(prices.data ?? []).map((p) => (
                <li key={p.model} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 font-medium">{p.model}</span>
                  <span className="text-[13px] text-neutral-700 tabular-nums">
                    vstup {formatEur(Number(p.input_eur_per_mtok), 4)} · výstup{" "}
                    {formatEur(Number(p.output_eur_per_mtok), 4)}
                  </span>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-[13px]"
                    disabled={delPrice.isPending}
                    onClick={() => delPrice.mutate(p.model)}
                    aria-label={`Zmazať cenu – ${p.model}`}
                  >
                    Zmazať
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Field id="price-model" label="Model" className="min-w-56 flex-1">
              <Input
                id="price-model"
                spellCheck={false}
                value={price.model}
                onChange={(e) => setPrice({ ...price, model: e.target.value })}
              />
            </Field>
            <Field id="price-input" label="Vstup €/1M" className="w-36">
              <Input
                id="price-input"
                inputMode="decimal"
                value={price.input}
                onChange={(e) => setPrice({ ...price, input: e.target.value })}
              />
            </Field>
            <Field id="price-output" label="Výstup €/1M" className="w-36">
              <Input
                id="price-output"
                inputMode="decimal"
                value={price.output}
                onChange={(e) => setPrice({ ...price, output: e.target.value })}
              />
            </Field>
            <Button variant="secondary" onClick={addPrice} disabled={savePrice.isPending}>
              Uložiť cenu
            </Button>
          </div>
        </section>
        {save.isSuccess && draft === null && (
          <FormMessage tone="success">Modely sú uložené.</FormMessage>
        )}
        {(problem || save.error || savePrice.error || delPrice.error) && (
          <FormMessage tone="error">
            {problem ?? (save.error ?? savePrice.error ?? delPrice.error)?.message}
          </FormMessage>
        )}
      </div>
    </SettingsTile>
  );
}

export function AiFeaturesTile() {
  const flags = useFeatureFlags();
  const toggle = useToggleFlag();
  const settings = useAiSettings();
  const key = useAiKeyStatus();
  return (
    <SettingsTile size="XL" title="Funkcie">
      <ul className="flex flex-col divide-y divide-neutral-200">
        {AI_PURPOSES.map((p) => {
          const on = flags.data?.find((f) => f.key === p.flag)?.enabled ?? false;
          const model = settings.data?.models[p.key];
          return (
            <li key={p.flag} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.label}</p>
                <p className="text-[13px] text-neutral-700">{p.description}</p>
                {on && (!model || !key.data?.is_set) && (
                  <p className="text-warning text-[13px]">
                    {!key.data?.is_set ? "Chýba API kľúč." : "Chýba model pre tento účel."} Funkcia
                    zatiaľ nebude dostupná.
                  </p>
                )}
              </div>
              <StatusBadge label={on ? "Zapnutá" : "Vypnutá"} tone={on ? "success" : "neutral"} />
              <Button
                variant="secondary"
                disabled={toggle.isPending || !flags.data}
                onClick={() => toggle.mutate({ key: p.flag, enabled: !on })}
                aria-label={`${on ? "Vypnúť" : "Zapnúť"} – ${p.label}`}
              >
                {on ? "Vypnúť" : "Zapnúť"}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[13px] text-neutral-500">
        Samotné funkcie pribudnú vo fázach F3.5 (katalóg) a F4.5 (e-maily). Vypnutá funkcia AI
        nevolá.
      </p>
      {toggle.error && <FormMessage tone="error">{toggle.error.message}</FormMessage>}
    </SettingsTile>
  );
}

export function AiBudgetTile() {
  const budget = useAiBudget();
  const settings = useAiSettings();
  const save = useSaveAiSettings();
  const [draft, setDraft] = useState<{ limit: string; cutoff: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const b = budget.data;
  const toText = (n: number | undefined) => (n == null ? "" : n.toFixed(2).replace(".", ","));
  const limitText = draft?.limit ?? toText(settings.data?.limit);
  const cutoffText = draft?.cutoff ?? toText(settings.data?.cutoff);
  const FORM = "ai-budget-form";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const limit = parseDecimal(limitText, 2);
    const cutoff = parseDecimal(cutoffText, 2);
    if (limit == null || cutoff == null) return setProblem("Zadajte sumy v eurách (napr. 5,00).");
    if (cutoff > limit) return setProblem("Hranica vypnutia nesmie byť vyššia ako rozpočet.");
    // order matters: the cut-off must never be above the budget, also between the two updates
    const rows =
      limit >= (settings.data?.limit ?? 0)
        ? [
            { key: "ai_budget_limit_eur", value: limit },
            { key: "ai_budget_cutoff_eur", value: cutoff },
          ]
        : [
            { key: "ai_budget_cutoff_eur", value: cutoff },
            { key: "ai_budget_limit_eur", value: limit },
          ];
    save.mutate(rows, { onSuccess: () => setDraft(null) });
  };

  return (
    <SettingsTile
      size="XL"
      title="Rozpočet a poistka"
      action={
        <Button
          type="submit"
          form={FORM}
          variant="secondary"
          disabled={draft === null || save.isPending}
        >
          Uložiť rozpočet
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="ai-budget">
        <div className="flex flex-wrap items-end gap-6">
          <KpiNumber
            value={b ? formatEur(b.spent_eur, 2) : "…"}
            hint={
              b
                ? `${String(b.pct).replace(".", ",")} % z rozpočtu ${formatEur(b.limit_eur)}`
                : undefined
            }
          />
          {b && <StatusBadge label={BUDGET[b.state].label} tone={BUDGET[b.state].tone} />}
        </div>
        {b?.state === "blocked" && (
          <FormMessage tone="error">
            AI je vypnutá – spotreba dosiahla {formatEur(b.cutoff_eur)}. AI tlačidlá v systéme sú
            zašednuté, ručná práca funguje ďalej. Ak chcete pokračovať, zvýšte rozpočet a hranicu
            vypnutia.
          </FormMessage>
        )}
        <form id={FORM} onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field id="ai-limit" label="Rozpočet (EUR)" className="w-40">
            <Input
              id="ai-limit"
              inputMode="decimal"
              value={limitText}
              onChange={(e) => setDraft({ limit: e.target.value, cutoff: cutoffText })}
            />
          </Field>
          <Field id="ai-cutoff" label="Vypnúť AI pri (EUR)" className="w-40">
            <Input
              id="ai-cutoff"
              inputMode="decimal"
              value={cutoffText}
              onChange={(e) => setDraft({ limit: limitText, cutoff: e.target.value })}
            />
          </Field>
        </form>
        <p className="text-[13px] text-neutral-500">
          Upozornenie pri 50 % a 90 % rozpočtu (e-mail príjemcom notifikácií od fázy 8). Toto je
          tretia vrstva poistky – prvé dve (rozpočet a kvóta v Google Cloud) nastavte podľa
          DEPLOYMENT.md.
        </p>
        {(problem || save.error || budget.error) && (
          <FormMessage tone="error">{problem ?? (save.error ?? budget.error)?.message}</FormMessage>
        )}
      </div>
    </SettingsTile>
  );
}

export function AiUsageTile() {
  const usage = useAiUsage();
  const rows = usage.data ?? [];
  const group = (scope: string) => rows.filter((r) => r.scope === scope);
  return (
    <SettingsTile size="XL" title="Prehľad spotreby">
      {usage.error && <FormMessage tone="error">{usage.error.message}</FormMessage>}
      {usage.data && rows.length === 0 ? (
        <EmptyState title="Zatiaľ bez volaní AI" />
      ) : (
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Spotreba AI</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
              <th scope="col" className="h-10 pr-3">
                Čo
              </th>
              <th scope="col" className="px-3 text-right">
                Volania
              </th>
              <th scope="col" className="px-3 text-right">
                Tokeny vstup / výstup
              </th>
              <th scope="col" className="px-3 text-right">
                Cena
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ...group("total"),
              ...group("feature"),
              ...group("month").sort((a, b) => b.key.localeCompare(a.key)),
            ].map((r) => (
              <tr key={`${r.scope}-${r.key}`} className="h-10 border-b border-neutral-200">
                <td className={r.scope === "total" ? "pr-3 font-semibold" : "pr-3"}>
                  {r.scope === "total"
                    ? "Spolu"
                    : r.scope === "feature"
                      ? (FEATURE_LABELS[r.key] ?? r.key)
                      : `${r.key.slice(5, 7)}/${r.key.slice(0, 4)}`}
                </td>
                <td className="px-3 text-right tabular-nums">{r.calls}</td>
                <td className="px-3 text-right tabular-nums">
                  {r.input_tokens.toLocaleString("sk-SK")} /{" "}
                  {r.output_tokens.toLocaleString("sk-SK")}
                </td>
                <td className="px-3 text-right tabular-nums">{formatEur(r.cost_eur, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SettingsTile>
  );
}
