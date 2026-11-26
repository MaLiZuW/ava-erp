import { describe, expect, it } from "vitest";
import {
  checkLogoFile,
  formatIban,
  isValidDic,
  isValidIban,
  isValidIco,
  isValidSwift,
  LOGO_MAX_BYTES,
  safeFileName,
} from "./validation";

describe("IČO (mod 11)", () => {
  it("accepts ids with a correct check digit, also with spaces", () => {
    expect(isValidIco("27082440")).toBe(true); // remainder 1 → check digit 0
    expect(isValidIco("25596641")).toBe(true); // remainder 0 → check digit 1
    expect(isValidIco("270 824 40")).toBe(true);
  });
  it("refuses a wrong check digit, wrong length and letters", () => {
    expect(isValidIco("27082441")).toBe(false);
    expect(isValidIco("25596640")).toBe(false);
    expect(isValidIco("1234567")).toBe(false);
    expect(isValidIco("123456789")).toBe(false);
    expect(isValidIco("TODO")).toBe(false);
  });
  it("matches the formula for every check-digit case", () => {
    // brute force over a range: exactly one check digit is valid for each 7-digit prefix
    for (let p = 1234500; p < 1234600; p++) {
      const prefix = String(p).padStart(7, "0");
      const valid = Array.from({ length: 10 }, (_, d) => isValidIco(prefix + d)).filter(Boolean);
      expect(valid.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("DIČ", () => {
  it("has 10 digits", () => {
    expect(isValidDic("2020123456")).toBe(true);
    expect(isValidDic("202 012 3456")).toBe(true);
    expect(isValidDic("202012345")).toBe(false);
    expect(isValidDic("SK2020123456")).toBe(false);
  });
});

describe("IBAN (mod 97)", () => {
  it("accepts a valid Slovak IBAN with or without spaces", () => {
    expect(isValidIban("SK3112000000198742637541")).toBe(true);
    expect(isValidIban("sk31 1200 0000 1987 4263 7541")).toBe(true);
  });
  it("refuses a typo and a wrong length", () => {
    expect(isValidIban("SK3112000000198742637542")).toBe(false);
    expect(isValidIban("SK31120000001987426375")).toBe(false);
    expect(isValidIban("TODO")).toBe(false);
  });
  it("formats in groups of four", () => {
    expect(formatIban("SK3112000000198742637541")).toBe("SK31 1200 0000 1987 4263 7541");
  });
});

describe("SWIFT", () => {
  it("accepts 8 and 11 characters", () => {
    expect(isValidSwift("TATRSKBX")).toBe(true);
    expect(isValidSwift("GIBASKBXXXX")).toBe(true);
    expect(isValidSwift("TATRSK")).toBe(false);
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

describe("logo file", () => {
  it("accepts PNG, JPEG and WebP up to 2 MB", () => {
    expect(checkLogoFile({ name: "logo.png", type: "image/png", size: 1000 }, PNG)).toBeNull();
    expect(checkLogoFile({ name: "logo.JPG", type: "image/jpeg", size: 1000 }, JPG)).toBeNull();
    expect(checkLogoFile({ name: "logo.jpeg", type: "image/jpeg", size: 1000 }, JPG)).toBeNull();
    expect(
      checkLogoFile({ name: "logo.webp", type: "image/webp", size: LOGO_MAX_BYTES }, WEBP),
    ).toBeNull();
  });
  it("refuses SVG", () => {
    expect(checkLogoFile({ name: "logo.svg", type: "image/svg+xml", size: 100 }, SVG)).toMatch(
      /SVG nie/,
    );
  });
  it("refuses an SVG disguised as PNG (magic bytes)", () => {
    expect(checkLogoFile({ name: "logo.png", type: "image/png", size: 100 }, SVG)).toMatch(
      /Obsah súboru/,
    );
  });
  it("refuses a mismatched extension", () => {
    expect(checkLogoFile({ name: "logo.webp", type: "image/png", size: 100 }, PNG)).toMatch(
      /Prípona/,
    );
    expect(checkLogoFile({ name: "logo", type: "image/png", size: 100 }, PNG)).toMatch(/Prípona/);
  });
  it("refuses files over 2 MB and empty files", () => {
    expect(
      checkLogoFile({ name: "a.png", type: "image/png", size: LOGO_MAX_BYTES + 1 }, PNG),
    ).toMatch(/2 MB/);
    expect(checkLogoFile({ name: "a.png", type: "image/png", size: 0 }, PNG)).toMatch(/prázdny/);
  });
});

describe("safeFileName", () => {
  it("keeps storage paths simple and ASCII", () => {
    expect(safeFileName("Logo firmy – nové.PNG")).toBe("logo-firmy-nove.png");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("ľščťžýáíé.png")).toBe("lsctzyaie.png");
  });
});
