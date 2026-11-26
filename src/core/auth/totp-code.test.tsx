import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { normalizeTotpCode, totpCodeSchema } from "./schemas";
import { TotpCodeForm } from "./totp-forms";

vi.mock("@/core/supabase/client", () => ({ getSupabase: () => ({}) }));

const VARIANTS = [
  "123456",
  "123 456",
  " 123 456 ",
  "123  456",
  "123 456", // non-breaking space (copied from some authenticator apps)
  "123 456", // narrow non-breaking space
  "123-456",
  "123 456\n",
];

describe("TOTP code normalisation", () => {
  it.each(VARIANTS)("accepts %j as 123456", (input) => {
    expect(normalizeTotpCode(input)).toBe("123456");
    expect(totpCodeSchema.parse({ code: input })).toEqual({ code: "123456" });
  });

  it.each(["12345", "1234567", "12a456", "", "123 45"])("refuses %j", (input) => {
    expect(totpCodeSchema.safeParse({ code: input }).success).toBe(false);
  });
});

describe("TotpCodeForm", () => {
  const setup = () => {
    const onCode = vi.fn(async () => null);
    render(<TotpCodeForm onCode={onCode} />);
    return { onCode, input: screen.getByLabelText(/Kód z aplikácie/) };
  };

  it.each(["123 456", " 123 456 ", "123-456"])("typed %j submits 123456", async (typed) => {
    const user = userEvent.setup();
    const { onCode, input } = setup();
    await user.type(input, typed);
    await user.click(screen.getByRole("button", { name: "Overiť" }));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("123456"));
  });

  it.each([" 123 456 ", "123 456", "123  456"])("pasted %j submits 123456", async (pasted) => {
    const user = userEvent.setup();
    const { onCode, input } = setup();
    await user.click(input);
    await user.paste(pasted);
    await user.click(screen.getByRole("button", { name: "Overiť" }));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("123456"));
  });

  it("shows the error for an incomplete code", async () => {
    const user = userEvent.setup();
    const { onCode, input } = setup();
    await user.type(input, "123 45");
    await user.click(screen.getByRole("button", { name: "Overiť" }));
    expect(await screen.findByText("Kód má 6 číslic.")).toBeInTheDocument();
    expect(onCode).not.toHaveBeenCalled();
  });
});
