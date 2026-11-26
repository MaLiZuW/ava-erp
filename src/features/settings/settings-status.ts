"use client";

import type { StatusTone } from "@/ui/status-badge";
import { useCompany } from "./api";
import { useUsers } from "./components/users-tile";
import { useTaxBrackets } from "./reporting-api";

export interface PageStatus {
  text: string;
  tone: StatusTone;
  /** short marker in the settings menu: a number, or "" for a dot only */
  short: string;
}

/**
 * What needs attention in the settings – one source for the markers in the settings menu and
 * the state badges on the overview (owner's points 20, 21). Blocks I and L add "Na overenie N"
 * and "AI kľúč nenastavený" here.
 */
/** `loaded`: false until the data behind the markers is known (no premature "V poriadku"). */
export function useSettingsStatus(): Record<string, PageStatus> & { loaded?: boolean } {
  const company = useCompany();
  const users = useUsers();
  const tax = useTaxBrackets();
  const out: Record<string, PageStatus> & { loaded?: boolean } = {};
  const c = company.data;
  if (company.data !== undefined) {
    if (!c?.logo_document_id)
      out["/nastavenia/firma/logo/"] = { text: "Logo chýba", tone: "warning", short: "" };
    if (!c?.ico || c.ico === "TODO" || !c?.iban)
      out["/nastavenia/firma/"] = { text: "Údaje neúplné", tone: "warning", short: "" };
  }
  const weak = (users.data ?? []).filter((u) => u.verified_totp_factors < 2).length;
  if (weak > 0)
    out["/nastavenia/pouzivatelia/"] = {
      text: `${weak} bez záložného faktora 2FA`,
      tone: "warning",
      short: String(weak),
    };
  if (tax.data && tax.data.length === 0)
    out["/nastavenia/reporting/dane/"] = {
      text: "Pásma dane nezadané",
      tone: "warning",
      short: "",
    };
  Object.defineProperty(out, "loaded", {
    value: company.data !== undefined && users.data !== undefined && tax.data !== undefined,
    enumerable: false,
  });
  return out;
}
