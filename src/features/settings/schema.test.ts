import { describe, expect, it } from "vitest";
import { companySchema, recipientSchema, SYSTEM_SETTINGS, type CompanyInput } from "./schema";

const empty: CompanyInput = {
  legal_name: "AV-agency, s.r.o.",
  brand_name: "Add Value Agency",
  ico: "",
  dic: "",
  ic_dph: "",
  street: "",
  city: "",
  zip: "",
  country: "SK",
  registry_entry: "",
  iban: "",
  bank_name: "",
  swift: "",
  email: "",
  phone: "",
  web: "",
};

describe("companySchema", () => {
  it("accepts a minimal company; empty optional fields become null (IČ DPH stays empty)", () => {
    const r = companySchema.parse(empty);
    expect(r.ico).toBeNull();
    expect(r.ic_dph).toBeNull();
    expect(r.country).toBe("SK");
  });

  it("normalises valid values", () => {
    const r = companySchema.parse({
      ...empty,
      ico: "270 824 40",
      dic: "2020 123 456",
      iban: "sk3112000000198742637541",
      swift: "tatrskbx",
      zip: "81101",
    });
    expect(r.ico).toBe("27082440");
    expect(r.dic).toBe("2020123456");
    expect(r.iban).toBe("SK31 1200 0000 1987 4263 7541");
    expect(r.swift).toBe("TATRSKBX");
    expect(r.zip).toBe("811 01");
  });

  it("refuses an IČO with a wrong check digit and the seed placeholder TODO", () => {
    const bad = companySchema.safeParse({ ...empty, ico: "27082441" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toMatch(/IČO nie je platné/);
    expect(companySchema.safeParse({ ...empty, ico: "TODO" }).success).toBe(false);
  });

  it("refuses an invalid IBAN, DIČ and e-mail", () => {
    expect(companySchema.safeParse({ ...empty, iban: "SK3112000000198742637542" }).success).toBe(
      false,
    );
    expect(companySchema.safeParse({ ...empty, dic: "123" }).success).toBe(false);
    expect(companySchema.safeParse({ ...empty, email: "nie-je-email" }).success).toBe(false);
  });

  it("requires the legal name", () => {
    expect(companySchema.safeParse({ ...empty, legal_name: "  " }).success).toBe(false);
  });
});

describe("settings", () => {
  it("inactivity minutes must be 5–240", () => {
    const s = SYSTEM_SETTINGS.inactivity_minutes.schema;
    expect(s.parse("30")).toBe(30);
    expect(s.safeParse("4").success).toBe(false);
    expect(s.safeParse("241").success).toBe(false);
    expect(s.safeParse("abc").success).toBe(false);
  });

  it("recipient e-mail is normalised", () => {
    expect(recipientSchema.parse({ email: " Konatel@AV-Agency.sk " }).email).toBe(
      "konatel@av-agency.sk",
    );
  });
});
