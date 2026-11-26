/**
 * WCAG 2.1 AA: text colours must have contrast ≥ 4.5 : 1 on white tiles and on the canvas.
 * Reads the real tokens from globals.css, so a colour change cannot silently break accessibility.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXT_TOKENS = [
  "ink",
  "brand-navy",
  "neutral-500",
  "neutral-700",
  "success",
  "warning",
  "danger",
];

describe("colour contrast (WCAG AA)", () => {
  it.each(TEXT_TOKENS)("--%s has ≥ 4.5:1 on white and on the canvas", (name) => {
    const c = token(name);
    expect(contrast(c, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c, token("canvas"))).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on the primary navy button has ≥ 4.5:1", () => {
    expect(contrast("#ffffff", token("brand-navy"))).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on the danger button has ≥ 4.5:1", () => {
    expect(contrast("#ffffff", token("danger"))).toBeGreaterThanOrEqual(4.5);
  });

  it("brand blue is NOT usable as text on white (accents only)", () => {
    expect(contrast(token("brand-blue"), "#ffffff")).toBeLessThan(4.5);
  });
});
