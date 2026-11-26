import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContextProvider, type AuthState } from "./auth-provider";
import { RequireAal2 } from "./require-aal2";
import { RequireRole } from "./require-role";
import {
  AUTH_ROUTES,
  authErrorMessage,
  hasRole,
  linkTypeFromHash,
  resolveAuthStatus,
  routeForStatus,
  safeNext,
  withNext,
  type AuthStatus,
} from "./status";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/zakazky/",
  useRouter: () => ({ replace, push: vi.fn() }),
}));

function auth(status: AuthStatus, roles: AuthState["roles"] = []): AuthState {
  return {
    status,
    userId: status === "signed-out" ? null : "u1",
    email: null,
    fullName: null,
    roles,
    refresh: async () => status,
    signOut: async () => {},
  };
}

function renderGuarded(state: AuthState) {
  return render(
    <AuthContextProvider value={state}>
      <RequireAal2>
        <p>tajné dáta</p>
      </RequireAal2>
    </AuthContextProvider>,
  );
}

describe("resolveAuthStatus", () => {
  it("maps session and assurance levels", () => {
    expect(resolveAuthStatus(false, null, null)).toBe("signed-out");
    expect(resolveAuthStatus(true, "aal1", "aal1")).toBe("needs-enroll");
    expect(resolveAuthStatus(true, "aal1", "aal2")).toBe("needs-verify");
    expect(resolveAuthStatus(true, "aal2", "aal2")).toBe("ready");
    expect(resolveAuthStatus(true, "aal1", "aal1", true)).toBe("needs-password");
    expect(resolveAuthStatus(false, null, null, true)).toBe("signed-out");
  });

  it("routes every non-ready state to a sign-in step", () => {
    expect(routeForStatus("signed-out")).toBe(AUTH_ROUTES.signIn);
    expect(routeForStatus("needs-verify")).toBe(AUTH_ROUTES.verify);
    expect(routeForStatus("needs-enroll")).toBe(AUTH_ROUTES.enroll);
    expect(routeForStatus("needs-password")).toBe(AUTH_ROUTES.newPassword);
    expect(routeForStatus("ready")).toBeNull();
    expect(routeForStatus("loading")).toBeNull();
  });
});

describe("linkTypeFromHash", () => {
  it("recognises invitation and recovery links only", () => {
    expect(linkTypeFromHash("#access_token=x&type=invite")).toBe("invite");
    expect(linkTypeFromHash("#access_token=x&type=recovery")).toBe("recovery");
    expect(linkTypeFromHash("#access_token=x&type=signup")).toBeNull();
    expect(linkTypeFromHash("")).toBeNull();
  });
});

describe("safeNext", () => {
  it("accepts internal paths only", () => {
    expect(safeNext("/zakazky/?id=1")).toBe("/zakazky/?id=1");
    expect(safeNext("https://evil.example/")).toBe("/");
    expect(safeNext("//evil.example/")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/prihlasenie/overenie/")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("builds next= only for non-root targets", () => {
    expect(withNext(AUTH_ROUTES.signIn, "/")).toBe(AUTH_ROUTES.signIn);
    expect(withNext(AUTH_ROUTES.signIn, "/zakazky/")).toBe("/prihlasenie/?next=%2Fzakazky%2F");
  });
});

describe("authErrorMessage", () => {
  it("translates known errors and never leaks raw messages", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("Nesprávny e-mail alebo heslo.");
    expect(authErrorMessage({ code: "mfa_verification_failed" })).toMatch(/^Neplatný kód/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Príliš veľa pokusov/);
    expect(authErrorMessage({ code: "x", message: "internal detail" })).not.toContain(
      "internal detail",
    );
  });
});

describe("RequireAal2", () => {
  beforeEach(() => replace.mockClear());

  it("shows a skeleton while loading and does not redirect", () => {
    renderGuarded(auth("loading"));
    expect(screen.queryByText("tajné dáta")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Overujem prihlásenie");
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a signed-out visitor to sign-in with the return path", () => {
    renderGuarded(auth("signed-out"));
    expect(screen.queryByText("tajné dáta")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/prihlasenie/?next=%2Fzakazky%2F");
  });

  it("sends aal1 without a factor to factor enrolment", () => {
    renderGuarded(auth("needs-enroll"));
    expect(screen.queryByText("tajné dáta")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/prihlasenie\/registracia-faktora\//),
    );
  });

  it("sends aal1 with a factor to the code prompt", () => {
    renderGuarded(auth("needs-verify"));
    expect(screen.queryByText("tajné dáta")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/prihlasenie\/overenie\//));
  });

  it("renders content only with aal2", () => {
    renderGuarded(auth("ready", ["admin"]));
    expect(screen.getByText("tajné dáta")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("explains a missing configuration instead of hanging", () => {
    renderGuarded(auth("config-error"));
    expect(screen.getByRole("alert")).toHaveTextContent("nie je nakonfigurovaná");
  });
});

describe("roles", () => {
  it("admin has every role, others only their own", () => {
    expect(hasRole(["admin"], "accountant")).toBe(true);
    expect(hasRole(["manager"], "admin")).toBe(false);
    expect(hasRole([], "manager")).toBe(false);
  });

  it("RequireRole hides content from users without the role", () => {
    render(
      <AuthContextProvider value={auth("ready", ["manager"])}>
        <RequireRole role="admin">
          <p>nastavenia</p>
        </RequireRole>
      </AuthContextProvider>,
    );
    expect(screen.queryByText("nastavenia")).not.toBeInTheDocument();
    expect(screen.getByText("Nemáte oprávnenie")).toBeVisible();
  });

  it("RequireRole shows content to admin", () => {
    render(
      <AuthContextProvider value={auth("ready", ["admin"])}>
        <RequireRole role="admin">
          <p>nastavenia</p>
        </RequireRole>
      </AuthContextProvider>,
    );
    expect(screen.getByText("nastavenia")).toBeVisible();
  });
});
