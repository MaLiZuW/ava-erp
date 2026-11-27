import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { dateField } from "@/core/form-fields";
import { DateInput, HolidaysContext } from "./date-input";
import { fieldMinWidth } from "./number-stepper";

function Controlled({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <DateInput aria-label="Dátum" value={v} onChange={(e) => setV(e.target.value)} />;
}

describe("DateInput with a calendar (point 19)", () => {
  it("picks a day from the calendar (Slovak, Monday first) and writes DD/MM/YYYY", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="10/06/2026" />);
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    const dialog = screen.getByRole("dialog", { name: "Kalendár" });
    // Monday is the first column
    expect(dialog.querySelector("th")?.textContent?.toLowerCase()).toMatch(/^po/);
    await user.click(screen.getByRole("button", { name: /^15\/06\/2026/ }));
    expect(screen.getByLabelText("Dátum")).toHaveValue("15/06/2026");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("“Dnes” picks today; Esc closes; typing still works", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText("Dátum");
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    await user.click(screen.getByRole("button", { name: "Dnes" }));
    const t = new Date();
    const today = `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
    expect(input).toHaveValue(today);
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "01/02/2027");
    expect(input).toHaveValue("01/02/2027");
  });

  it("marks days of rest and weekends with text (not colour only)", async () => {
    const user = userEvent.setup();
    render(
      <HolidaysContext value={new Map([["2026-12-24", "Štedrý deň"]])}>
        <Controlled initial="01/12/2026" />
      </HolidaysContext>,
    );
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    expect(
      screen.getByRole("button", { name: "24/12/2026 – deň pracovného pokoja: Štedrý deň" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "05/12/2026 – víkend" })).toBeInTheDocument();
  });

  it("respects min / max dates", async () => {
    const user = userEvent.setup();
    render(
      <DateInput
        aria-label="Dátum"
        defaultValue="10/06/2026"
        minDate="2026-06-05"
        maxDate="2026-06-20"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    expect(screen.getByRole("button", { name: /^04\/06\/2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^21\/06\/2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^05\/06\/2026/ })).toBeEnabled();
  });

  it("a picked day reaches react-hook-form register(); an impossible date is refused", async () => {
    const user = userEvent.setup();
    const schema = z.object({ d: dateField() });
    const onValid = vi.fn();
    function Form() {
      const { register, handleSubmit, formState } = useForm<
        z.input<typeof schema>,
        unknown,
        z.output<typeof schema>
      >({
        resolver: zodResolver(schema),
        defaultValues: { d: "31/02/2026" },
      });
      return (
        <form onSubmit={handleSubmit(onValid)}>
          <DateInput aria-label="Dátum" {...register("d")} />
          {formState.errors.d && <p>{formState.errors.d.message}</p>}
          <button type="submit">Uložiť</button>
        </form>
      );
    }
    render(<Form />);
    await user.click(screen.getByRole("button", { name: "Uložiť" }));
    expect(await screen.findByText(/DD\/MM\/YYYY/)).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Vybrať dátum z kalendára" }));
    await user.click(screen.getByRole("button", { name: "Dnes" }));
    await user.click(screen.getByRole("button", { name: "Uložiť" }));
    expect(onValid).toHaveBeenCalledTimes(1);
  });
});

describe("NumberStepper field width (point 18)", () => {
  it("is wide enough for the longest value plus the unit", () => {
    expect(fieldMinWidth("1,5", 24, 2, "h")).toContain("6ch"); // at least 6 characters
    expect(fieldMinWidth("", 365, 0)).toContain("6ch");
    expect(fieldMinWidth("123456789", undefined, 4)).toContain("9ch");
  });
});
