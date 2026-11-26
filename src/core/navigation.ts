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

export function findNavItem(pathname: string): NavItem | undefined {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/?$/, "/");
  return NAV_ITEMS.find((i) => i.href === normalized);
}

/** Items the user may see (role-based hiding). */
export function visibleNavItems(roles: readonly AppRole[]): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.requiredRole || hasRole(roles, i.requiredRole));
}
