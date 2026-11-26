import { describe, expect, it, vi } from "vitest";
import { handle, type Deps } from "./handler";

const ADMIN = "a0000000-0000-0000-0000-00000000000a";
const OTHER = "b0000000-0000-0000-0000-00000000000b";

function deps(over: Partial<Deps> = {}): Deps & { logs: string[] } {
  const logs: string[] = [];
  return {
    verifyToken: vi.fn(async (t: string) =>
      t === "good-aal2"
        ? { sub: ADMIN, aal: "aal2" }
        : t === "good-aal1"
          ? { sub: ADMIN, aal: "aal1" }
          : null,
    ),
    isActiveAdmin: vi.fn(async (id: string) => id === ADMIN),
    getUserEmail: vi.fn(async (id: string) => (id === OTHER ? "kolega@example.sk" : null)),
    deleteAllFactors: vi.fn(async () => 2),
    audit: vi.fn(async () => {}),
    log: (m: string) => logs.push(m),
    logs,
    ...over,
  };
}

function req(
  opts: { token?: string; origin?: string | null; body?: unknown; method?: string } = {},
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  if (opts.origin !== null) headers.set("Origin", opts.origin ?? "https://app.av-agency.sk");
  return new Request("https://x.supabase.co/functions/v1/admin-mfa-reset", {
    method: opts.method ?? "POST",
    headers,
    body: opts.method === "OPTIONS" ? undefined : JSON.stringify(opts.body ?? { user_id: OTHER }),
  });
}

describe("admin-mfa-reset", () => {
  it("resets the factors of another user and writes the audit", async () => {
    const d = deps();
    const res = await handle(req({ token: "good-aal2" }), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 2 });
    expect(d.deleteAllFactors).toHaveBeenCalledWith(OTHER);
    expect(d.audit).toHaveBeenCalledWith({
      actor: ADMIN,
      target: OTHER,
      targetEmail: "kolega@example.sk",
      removed: 2,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.av-agency.sk");
  });

  it("refuses a foreign origin before looking at the token", async () => {
    const d = deps();
    const res = await handle(req({ token: "good-aal2", origin: "https://evil.example" }), d);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(d.verifyToken).not.toHaveBeenCalled();
  });

  it("answers the CORS preflight only for allowed origins", async () => {
    const ok = await handle(req({ method: "OPTIONS", origin: "http://localhost:3000" }), deps());
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("requires a verified token", async () => {
    expect((await handle(req({}), deps())).status).toBe(401);
    expect((await handle(req({ token: "forged" }), deps())).status).toBe(401);
    const throwing = deps({ verifyToken: vi.fn(async () => Promise.reject(new Error("jwks"))) });
    expect((await handle(req({ token: "good-aal2" }), throwing)).status).toBe(401);
  });

  it("requires aal2 from the verified claims", async () => {
    const d = deps();
    const res = await handle(req({ token: "good-aal1" }), d);
    expect(res.status).toBe(403);
    expect(d.deleteAllFactors).not.toHaveBeenCalled();
  });

  it("requires an active admin (from the database)", async () => {
    const d = deps({ isActiveAdmin: vi.fn(async () => false) });
    expect((await handle(req({ token: "good-aal2" }), d)).status).toBe(403);
    expect(d.deleteAllFactors).not.toHaveBeenCalled();
  });

  it("refuses resetting oneself", async () => {
    const d = deps();
    const res = await handle(
      req({ token: "good-aal2", body: { user_id: ADMIN.toUpperCase() } }),
      d,
    );
    expect(res.status).toBe(400);
    expect(d.deleteAllFactors).not.toHaveBeenCalled();
  });

  it("validates the target id and that the user exists", async () => {
    expect(
      (await handle(req({ token: "good-aal2", body: { user_id: "x' or 1=1" } }), deps())).status,
    ).toBe(400);
    const missing = "c0000000-0000-0000-0000-00000000000c";
    const d = deps();
    expect((await handle(req({ token: "good-aal2", body: { user_id: missing } }), d)).status).toBe(
      404,
    );
    expect(d.deleteAllFactors).not.toHaveBeenCalled();
  });

  it("only POST is allowed", async () => {
    expect((await handle(new Request("https://x/f", { method: "GET" }), deps())).status).toBe(405);
  });

  it("never logs the token or the request body", async () => {
    const d = deps();
    await handle(req({ token: "good-aal2" }), d);
    await handle(req({ token: "forged" }), d);
    const all = d.logs.join("\n");
    expect(all).not.toContain("good-aal2");
    expect(all).not.toContain("forged");
    expect(all).not.toContain(OTHER);
    expect(all).not.toContain("kolega@example.sk");
  });
});
