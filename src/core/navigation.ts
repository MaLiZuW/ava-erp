import { hasRole, type AppRole } from "./auth/status";

/** Single source of truth for the sidebar, page titles and the command palette (14 items). */
export interface NavItem {
  href: string;
  label: string;
  group: "main" | "master" | "bottom";
  /** hidden in the UI for users without this role (the database enforces it via RLS) */
  requiredRole?: AppRole;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Prehľad", group: "main" },
  { href: "/dopyty/", label: "Dopyty", group: "main" },
  { href: "/ponuky/", label: "Ponuky", group: "main" },
  { href: "/zakazky/", label: "Zákazky", group: "main" },
  { href: "/nakup/", label: "Nákup", group: "main" },
  { href: "/dodanie/", label: "Dodanie", group: "main" },
  { href: "/faktury/", label: "Faktúry", group: "main" },
  { href: "/emaily/", label: "E-maily", group: "main" },
  { href: "/reporty/", label: "Reporty a KPI", group: "main" },
  { href: "/dokumenty/", label: "Dokumenty", group: "main" },
  { href: "/zakaznici/", label: "Zákazníci", group: "master" },
  { href: "/dodavatelia/", label: "Dodávatelia", group: "master" },
  { href: "/katalog/", label: "Katalóg", group: "master" },
  { href: "/nastavenia/", label: "Nastavenia", group: "bottom", requiredRole: "admin" },
];

/** Exact match, or the section a sub-page belongs to (e.g. /zakaznici/detail/ → Zákazníci). */
export function findNavItem(pathname: string): NavItem | undefined {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/?$/, "/");
  return (
    NAV_ITEMS.find((i) => i.href === normalized) ??
    NAV_ITEMS.filter((i) => i.href !== "/" && normalized.startsWith(i.href)).sort(
      (x, y) => y.href.length - x.href.length,
    )[0]
  );
}

/** "+ Nové" menu and the "Nové" group of the command palette. */
export interface NewAction {
  href: string;
  label: string;
  requiredRole?: AppRole;
}

export const NEW_ACTIONS: readonly NewAction[] = [
  { href: "/zakaznici/detail/?id=new", label: "Zákazník", requiredRole: "admin" },
  { href: "/dodavatelia/detail/?id=new", label: "Dodávateľ", requiredRole: "admin" },
  { href: "/katalog/?tab=polozky&nova=1", label: "Položka katalógu", requiredRole: "admin" },
  { href: "/katalog/?tab=technika&nova=1", label: "Technika a vybavenie", requiredRole: "admin" },
];

export function visibleNewActions(roles: readonly AppRole[]): NewAction[] {
  return NEW_ACTIONS.filter((a) => !a.requiredRole || hasRole(roles, a.requiredRole));
}

/** Items the user may see (role-based hiding). */
export function visibleNavItems(roles: readonly AppRole[]): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.requiredRole || hasRole(roles, i.requiredRole));
}

// ---------------------------------------------------------------------------------------------
// Settings sections – ONE place for the secondary menu, the overview tiles, the main-menu
// sub-items and Ctrl+K (owner's point 20; pattern: Stripe / Linear / Vercel settings).
// ---------------------------------------------------------------------------------------------
export interface SettingsPage {
  href: string;
  label: string;
  /** extra words for Ctrl+K (field names: IBAN, logo …) */
  keywords: string[];
  /** tables whose change history is shown at the bottom of the page */
  historyTables: string[];
}

export interface SettingsGroup {
  key: string;
  label: string;
  description: string;
  pages: SettingsPage[];
}

export const SETTINGS_HOME = "/nastavenia/";

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: "firma",
    label: "Firma",
    description: "Údaje na doklady a logo.",
    pages: [
      {
        href: "/nastavenia/firma/",
        label: "Údaje firmy",
        keywords: [
          "obchodné meno",
          "IČO",
          "DIČ",
          "IČ DPH",
          "adresa",
          "IBAN",
          "SWIFT",
          "banka",
          "zápis v OR",
          "e-mail",
          "telefón",
          "web",
        ],
        historyTables: ["companies"],
      },
      {
        href: "/nastavenia/firma/logo/",
        label: "Logo",
        keywords: ["logo", "obrázok", "značka"],
        historyTables: ["companies", "documents"],
      },
    ],
  },
  {
    key: "pouzivatelia",
    label: "Používatelia a bezpečnosť",
    description: "Používatelia, roly a dvojfaktorové overenie.",
    pages: [
      {
        href: "/nastavenia/pouzivatelia/",
        label: "Používatelia a 2FA",
        keywords: ["používatelia", "2FA", "TOTP", "záložný faktor", "reset", "roly"],
        historyTables: ["user_roles", "profiles", "auth.mfa_factors"],
      },
    ],
  },
  {
    key: "system",
    label: "Systém",
    description: "Systémové nastavenia, funkcie a notifikácie.",
    pages: [
      {
        href: "/nastavenia/system/",
        label: "Systémové nastavenia",
        keywords: ["nečinnosť", "odhlásenie", "minúty"],
        historyTables: ["system_settings"],
      },
      {
        href: "/nastavenia/system/funkcie/",
        label: "Funkcie",
        keywords: ["feature flag", "service_cnc", "zapnúť funkciu"],
        historyTables: ["feature_flags"],
      },
      {
        href: "/nastavenia/system/notifikacie/",
        label: "Notifikácie",
        keywords: ["príjemcovia", "e-mail", "upozornenia"],
        historyTables: ["notification_recipients"],
      },
    ],
  },
  {
    key: "ai",
    label: "AI",
    description: "Poskytovateľ, kľúč, funkcie a rozpočet (pripravujeme – blok L).",
    pages: [
      {
        href: "/nastavenia/ai/",
        label: "AI",
        keywords: ["Gemini", "API kľúč", "rozpočet", "umelá inteligencia"],
        historyTables: [],
      },
    ],
  },
  {
    key: "reporting",
    label: "Reporting",
    description: "Réžia, dane z príjmov, kapacity a ciele KPI.",
    pages: [
      {
        href: "/nastavenia/reporting/rezia/",
        label: "Réžia",
        keywords: ["fixné náklady", "nájom", "réžia"],
        historyTables: ["overhead_costs"],
      },
      {
        href: "/nastavenia/reporting/dane/",
        label: "Dane z príjmov",
        keywords: ["daň", "pásma", "sadzba dane"],
        historyTables: ["income_tax_brackets"],
      },
      {
        href: "/nastavenia/reporting/kapacity/",
        label: "Kapacity",
        keywords: ["kalendár", "dovolenka", "týždenný vzor", "hodiny", "sviatky"],
        historyTables: ["work_patterns", "calendar_exceptions"],
      },
      {
        href: "/nastavenia/reporting/ciele-kpi/",
        label: "Ciele KPI",
        keywords: ["KPI", "ciele", "semafor"],
        historyTables: ["kpi_targets"],
      },
    ],
  },
  {
    key: "data",
    label: "Dáta",
    description: "Na overenie a číselníky (pripravujeme – bloky I, J, K).",
    pages: [
      {
        href: "/nastavenia/data/",
        label: "Na overenie a číselníky",
        keywords: ["overenie", "aktuálnosť dát", "číselníky"],
        historyTables: [],
      },
    ],
  },
  {
    key: "historia",
    label: "História zmien",
    description: "Všetky zmeny nastavení – kto, kedy, čo.",
    pages: [
      {
        href: "/nastavenia/historia/",
        label: "História zmien",
        keywords: ["audit", "zmeny", "kto zmenil"],
        historyTables: [],
      },
    ],
  },
];

export const SETTINGS_PAGES: readonly (SettingsPage & { group: SettingsGroup })[] =
  SETTINGS_GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g })));

/** The settings page of a path (sub-pages with trailing slash or without). */
export function findSettingsPage(pathname: string) {
  const normalized = pathname.replace(/\/?$/, "/");
  return SETTINGS_PAGES.find((p) => p.href === normalized);
}
