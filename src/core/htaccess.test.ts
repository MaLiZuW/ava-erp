import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const htaccess = readFileSync(join(process.cwd(), "public", ".htaccess"), "utf8");

describe("public/.htaccess", () => {
  it("redirects to HTTPS", () => {
    expect(htaccess).toMatch(/RewriteCond %\{HTTPS\} !=on/);
    expect(htaccess).toMatch(/RewriteRule \^ https:\/\//);
  });
  it("serves the exported 404 page", () => {
    expect(htaccess).toMatch(/ErrorDocument 404 \/404\.html/);
  });
  it("sets all required security headers", () => {
    for (const header of [
      "Strict-Transport-Security",
      'X-Frame-Options "DENY"',
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ]) {
      expect(htaccess).toContain(header);
    }
  });
  it("restricts CSP to own origin and Supabase", () => {
    const csp = /Content-Security-Policy "([^"]+)"/.exec(htaccess)?.[1] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
    expect(csp).not.toMatch(/https?:\/\/(?!\*\.supabase\.co)[a-z0-9.-]+/i);
  });
});
