import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthContextProvider, type AuthState } from "@/core/auth/auth-provider";
import { AppShell } from "./app-shell";
import { DocumentShell } from "./document-shell";
import { KpiNumber } from "./kpi-number";
import { ProcessRail, PROCESS_STEPS } from "./process-rail";
import { StatusBadge } from "./status-badge";
import { Tile } from "./tile";

const push = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

describe("Tile", () => {
  it("renders title and content with its size", () => {
    render(
      <Tile size="XL" title="Výsledok">
        obsah
      </Tile>,
    );
    const tile = screen.getByRole("region", { name: "Výsledok" });
    expect(tile).toHaveAttribute("data-size", "XL");
    expect(tile).toHaveTextContent("obsah");
  });
});

describe("StatusBadge", () => {
  it("always shows the state as text", () => {
    render(<StatusBadge label="Odoslaná" tone="success" />);
    expect(screen.getByText("Odoslaná")).toBeVisible();
  });
});

describe("KpiNumber", () => {
  it("shows value and label", () => {
    render(<KpiNumber value="12" label="Nové dopyty" />);
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("Nové dopyty")).toBeVisible();
  });
});

describe("ProcessRail", () => {
  it("marks exactly one current step and announces states", () => {
    render(<ProcessRail current={2} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(PROCESS_STEPS.length);
    expect(items.filter((i) => i.getAttribute("aria-current") === "step")).toHaveLength(1);
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[2]).toHaveAttribute("data-state", "current");
    expect(items[3]).toHaveAttribute("data-state", "todo");
  });
});

describe("DocumentShell", () => {
  it("shows number, status, amount and one primary next step", async () => {
    const onClick = vi.fn();
    render(
      <DocumentShell
        number="CP-2026-0001"
        status={{ label: "Návrh" }}
        totalCents={123456}
        nextStep={{ label: "Odoslať ponuku", onClick }}
        processIndex={1}
      />,
    );
    expect(screen.getByText("CP-2026-0001")).toBeVisible();
    expect(screen.getByText("Návrh")).toBeVisible();
    expect(screen.getByText(/1\s234,56\s€/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Odoslať ponuku" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

const signOut = vi.fn(async () => {});
function withAuth(ui: ReactNode, roles: AuthState["roles"] = ["admin"]) {
  const state: AuthState = {
    status: "ready",
    userId: "u1",
    email: "konatel@example.sk",
    fullName: "Konateľ Test",
    roles,
    refresh: async () => "ready",
    signOut,
  };
  return <AuthContextProvider value={state}>{ui}</AuthContextProvider>;
}

describe("AppShell", () => {
  it("renders 14 navigation links and marks the active page", () => {
    pathname = "/zakazky/";
    render(withAuth(<AppShell>obsah</AppShell>));
    const nav = screen.getByRole("navigation", { name: "Hlavná navigácia" });
    expect(within(nav).getAllByRole("link")).toHaveLength(13);
    const bottom = screen.getByRole("navigation", { name: "Nastavenia a profil" });
    expect(within(bottom).getAllByRole("link")).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: "Zákazky" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Zákazky");
  });

  it("opens the command palette with Ctrl+K and navigates", async () => {
    pathname = "/";
    render(withAuth(<AppShell>obsah</AppShell>));
    await userEvent.keyboard("{Control>}k{/Control}");
    const item = await screen.findByRole("option", { name: "Faktúry" });
    await userEvent.click(item);
    expect(push).toHaveBeenCalledWith("/faktury/");
  });

  it("hides Nastavenia from a user without the admin role", () => {
    pathname = "/";
    render(withAuth(<AppShell>obsah</AppShell>, ["manager"]));
    expect(screen.queryByRole("link", { name: "Nastavenia" })).not.toBeInTheDocument();
  });

  it("+ Nové offers new records to an admin and is disabled without a role", async () => {
    pathname = "/";
    const { unmount } = render(withAuth(<AppShell>obsah</AppShell>));
    await userEvent.click(screen.getByRole("button", { name: "+ Nové" }));
    const menu = screen.getByRole("list", { name: "Vytvoriť nový záznam" });
    expect(within(menu).getByRole("link", { name: "Zákazník" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/zakaznici\/detail\/?\?id=new$/),
    );
    expect(within(menu).getByRole("link", { name: "Dodávateľ" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Technika a vybavenie" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/katalog\/?\?tab=technika&nova=1$/),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list", { name: "Vytvoriť nový záznam" })).not.toBeInTheDocument();
    unmount();

    render(withAuth(<AppShell>obsah</AppShell>, []));
    expect(screen.getByRole("button", { name: "+ Nové" })).toBeDisabled();
  });

  it("pins Nastavenia below the scrollable module list", () => {
    pathname = "/";
    render(withAuth(<AppShell>obsah</AppShell>));
    const scroll = screen.getByTestId("sidebar-scroll");
    const bottom = screen.getByTestId("sidebar-bottom");
    // only the module list scrolls; the bottom block does not shrink and is not inside it
    expect(scroll.className).toMatch(/\boverflow-y-auto\b/);
    expect(scroll.className).toMatch(/\bmin-h-0\b/);
    expect(bottom.className).toMatch(/\bshrink-0\b/);
    expect(scroll).not.toContainElement(within(bottom).getByRole("link", { name: "Nastavenia" }));
    expect(scroll.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the signed-in user and signs out", async () => {
    pathname = "/";
    render(withAuth(<AppShell>obsah</AppShell>));
    expect(screen.getByTestId("current-user")).toHaveTextContent("Konateľ Test");
    await userEvent.click(screen.getByRole("button", { name: "Odhlásiť" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
