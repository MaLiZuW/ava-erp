import { describe, expect, it } from "vitest";
import { formatMoneyInput, formatPercent, parseDate, parseDecimal, parsePercent } from "./format";
import {
  dateField,
  moneyField,
  optDateField,
  optMoneyField,
  optPercentField,
  positiveDecimalField,
} from "./form-fields";

describe("input formatting / parsing", () => {
  it("formats cents for an input field", () => {
    expect(formatMoneyInput(123456)).toBe("1 234,56");
    expect(formatMoneyInput(5)).toBe("0,05");
    expect(formatMoneyInput(null)).toBe("");
  });

  it("formats and parses percentages", () => {
    expect(formatPercent("25.0000")).toBe("25");
    expect(formatPercent(12.5)).toBe("12,5");
    expect(parsePercent("12,5 %")).toBe(12.5);
    expect(parsePercent("33,33333")).toBeNull(); // max 4 decimals (numeric(7,4))
    expect(parsePercent("abc")).toBeNull();
  });

  it("parses DD/MM/YYYY and refuses impossible dates", () => {
    expect(parseDate("01/02/2027")).toBe("2027-02-01");
    expect(parseDate("1.2.2027")).toBe("2027-02-01");
    expect(parseDate("29/02/2028")).toBe("2028-02-29");
    expect(parseDate("29/02/2027")).toBeNull();
    expect(parseDate("31/04/2027")).toBeNull();
    expect(parseDate("2027-02-01")).toBeNull();
  });

  it("parses decimals with a comma", () => {
    expect(parseDecimal("1,5", 2)).toBe(1.5);
    expect(parseDecimal("3 000", 2)).toBe(3000);
    expect(parseDecimal("1,555", 2)).toBeNull();
    expect(parseDecimal("-1", 2)).toBeNull();
  });
});

describe("zod money / percent / date fields", () => {
  it("moneyField → cents, never negative", () => {
    expect(moneyField().parse("1 234,56")).toBe(123456);
    expect(moneyField().parse("0")).toBe(0);
    expect(moneyField().safeParse("-1").success).toBe(false);
    expect(moneyField().safeParse("").success).toBe(false);
    expect(moneyField().safeParse("1,234").success).toBe(false);
  });

  it("optMoneyField: empty → null", () => {
    expect(optMoneyField().parse(" ")).toBeNull();
    expect(optMoneyField().parse("40")).toBe(4000);
  });

  it("optPercentField respects the maximum", () => {
    expect(optPercentField(99.9999).parse("99,99")).toBe(99.99);
    expect(optPercentField(99.9999).safeParse("100").success).toBe(false);
    expect(optPercentField().safeParse("-5").success).toBe(false);
    expect(optPercentField().parse("")).toBeNull();
  });

  it("date fields convert to ISO", () => {
    expect(dateField().parse("15/03/2027")).toBe("2027-03-15");
    expect(dateField().safeParse("").success).toBe(false);
    expect(optDateField().parse("")).toBeNull();
  });

  it("positiveDecimalField refuses zero", () => {
    expect(positiveDecimalField(2, "x").parse("3000")).toBe(3000);
    expect(positiveDecimalField(2, "x").safeParse("0").success).toBe(false);
  });
});
