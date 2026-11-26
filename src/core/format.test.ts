import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, parseMoneyToCents } from "./format";

describe("formatDateTime", () => {
  it("formats in Bratislava time as DD/MM/YYYY HH:mm (winter and summer time)", () => {
    expect(formatDateTime("2026-11-27T08:05:00Z")).toBe("27/11/2026 09:05");
    expect(formatDateTime("2026-07-01T22:30:00Z")).toBe("02/07/2026 00:30");
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("nonsense")).toBe("");
  });
});

describe("formatDate", () => {
  it("formats DD/MM/YYYY", () => {
    expect(formatDate(new Date(2026, 10, 26))).toBe("26/11/2026");
    expect(formatDate(new Date(2026, 0, 5))).toBe("05/01/2026");
  });
  it("does not shift date-only strings by time zone", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
  it("handles ISO timestamps", () => {
    expect(formatDate("2026-11-26T12:00:00")).toBe("26/11/2026");
  });
  it("returns empty string for empty or invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("nonsense")).toBe("");
  });
});

describe("formatMoney", () => {
  const nb = " ";
  it("formats cents with comma and euro sign", () => {
    expect(formatMoney(123456)).toBe(`1${nb}234,56${nb}€`);
    expect(formatMoney(0)).toBe(`0,00${nb}€`);
    expect(formatMoney(5)).toBe(`0,05${nb}€`);
    expect(formatMoney(100000000)).toBe(`1${nb}000${nb}000,00${nb}€`);
  });
  it("handles negative amounts", () => {
    expect(formatMoney(-150)).toBe(`−1,50${nb}€`);
  });
  it("supports bigint from DB", () => {
    expect(formatMoney(9007199254740993n)).toBe(`90${nb}071${nb}992${nb}547${nb}409,93${nb}€`);
  });
  it("rejects non-integer cents (no float for money)", () => {
    expect(() => formatMoney(10.5)).toThrow(RangeError);
  });
  it("returns empty string for null", () => {
    expect(formatMoney(null)).toBe("");
  });
});

describe("parseMoneyToCents", () => {
  it("parses Slovak and plain formats", () => {
    expect(parseMoneyToCents("1 234,56")).toBe(123456);
    expect(parseMoneyToCents("1234.5")).toBe(123450);
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("-0,05 €")).toBe(-5);
  });
  it("avoids float rounding errors", () => {
    expect(parseMoneyToCents("0,29")).toBe(29);
    expect(parseMoneyToCents("1,15")).toBe(115);
  });
  it("returns null for invalid input", () => {
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1,234")).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
  });
});
