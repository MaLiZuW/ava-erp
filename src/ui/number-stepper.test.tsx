import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { moneyField } from "@/core/form-fields";
import { MoneyInput, stepMoneyText } from "./inputs";
import {
  canStep,
  NumberStepper,
  stepForUnit,
  stepValue,
  type NumberStepperProps,
} from "./number-stepper";

describe("stepForUnit", () => {
  it("follows the owner's rule", () => {
    expect(stepForUnit("ks")).toBe(1);
    expect(stepForUnit("bal")).toBe(1);
    expect(stepForUnit("hod")).toBe(0.5);
    expect(stepForUnit("kg")).toBe(0.1);
    expect(stepForUnit("m")).toBe(0.1);
    expect(stepForUnit("m2")).toBe(0.1);
    expect(stepForUnit("paušál")).toBe(1);
    expect(stepForUnit(undefined)).toBe(1);
  });
});

describe("stepValue", () => {
  it("steps with a decimal comma and no float noise", () => {
    expect(stepValue("0,2", 1, { step: 0.1 })).toBe("0,3"); // not 0,30000000000000004
    expect(stepValue("1,5", -1, { step: 0.5 })).toBe("1");
    expect(stepValue("1.25", 1, { step: 0.5 })).toBe("1,75");
  });

  it("Shift multiplies the step by 10", () => {
    expect(stepValue("3000", 1, { step: 100 }, 10)).toBe("4000");
    expect(stepValue("2", 1, { step: 1 }, 10)).toBe("12");
  });

  it("keeps the minimum; invalid or empty text counts as the minimum", () => {
    expect(stepValue("0", -1, { step: 1 })).toBe("0");
    expect(stepValue("3", -1, { step: 1 }, 10)).toBe("0");
    expect(stepValue("", 1, { step: 1 })).toBe("1");
    expect(stepValue("abc", 1, { step: 0.5, min: 0.5 })).toBe("1");
  });

  it("reaches an inclusive maximum, never an exclusive one", () => {
    expect(stepValue("364", 1, { step: 1, max: 365 }, 10)).toBe("365");
    expect(stepValue("99", 1, { step: 1, max: 100, maxExclusive: true })).toBe("99");
    expect(stepValue("95", 1, { step: 1, max: 100, maxExclusive: true }, 10)).toBe("96");
    expect(canStep("99", 1, { step: 1, max: 100, maxExclusive: true })).toBe(false);
    expect(canStep("98,5", 1, { step: 1, max: 100, maxExclusive: true })).toBe(true);
    expect(canStep("365", 1, { step: 1, max: 365 })).toBe(false);
    expect(canStep("0", -1, { step: 1 })).toBe(false);
  });
});

function Harness(props: Partial<NumberStepperProps> & { initial?: string }) {
  const { initial = "", ...rest } = props;
  const [value, setValue] = useState(initial);
  return <NumberStepper label="Množstvo" value={value} onChange={setValue} {...rest} />;
}

describe("NumberStepper", () => {
  it("− is disabled at the minimum; + and − change the value", async () => {
    const user = userEvent.setup();
    render(<Harness initial="0" />);
    const input = screen.getByLabelText("Množstvo");
    const minus = screen.getByRole("button", { name: "Znížiť – Množstvo" });
    const plus = screen.getByRole("button", { name: "Zvýšiť – Množstvo" });
    expect(minus).toBeDisabled();
    await user.click(plus);
    await user.click(plus);
    expect(input).toHaveValue("2");
    expect(minus).toBeEnabled();
    await user.click(minus);
    expect(input).toHaveValue("1");
  });

  it("onCommit: three quick clicks = one save after 800 ms (one history entry)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onCommit = vi.fn();
      render(<Harness initial="2" onCommit={onCommit} />);
      const plus = screen.getByRole("button", { name: "Zvýšiť – Množstvo" });
      await user.click(plus);
      await user.click(plus);
      await user.click(plus);
      vi.advanceTimersByTime(700);
      expect(onCommit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("5");
    } finally {
      vi.useRealTimers();
    }
  });

  it("onCommit: leaving the field or Enter saves at once; no change = no save", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <>
        <Harness initial="3,5" onCommit={onCommit} />
        <button type="button">inde</button>
      </>,
    );
    const input = screen.getByLabelText("Množstvo");
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "inde" }));
    expect(onCommit).not.toHaveBeenCalled(); // nothing changed
    await user.clear(input);
    await user.type(input, "5{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith("5");
    await user.click(screen.getByRole("button", { name: "inde" }));
    expect(onCommit).toHaveBeenCalledTimes(1); // already saved
  });

  it("arrow keys step, Shift steps ×10; typing still works", async () => {
    const user = userEvent.setup();
    render(<Harness initial="1" unit="hod" />);
    const input = screen.getByLabelText("Množstvo");
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("1,5");
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(input).toHaveValue("6,5");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveValue("6");
    await user.clear(input);
    await user.type(input, "12,25");
    expect(input).toHaveValue("12,25");
  });

  it("+ is disabled when the next step would reach an exclusive maximum (margin < 100 %)", async () => {
    render(<Harness initial="99" max={100} maxExclusive suffix="%" />);
    expect(screen.getByRole("button", { name: "Zvýšiť – Množstvo" })).toBeDisabled();
  });
});

describe("MoneyInput arrows", () => {
  it("stepMoneyText: ±1,00 €, Shift ±10,00 €, never below 0", () => {
    expect(stepMoneyText("2,50", 1, false)).toBe("3,50");
    expect(stepMoneyText("2,50", 1, true)).toBe("12,50");
    expect(stepMoneyText("0,50", -1, false)).toBe("0,00");
    expect(stepMoneyText("", 1, false)).toBe("1,00");
  });

  it("↑ reaches react-hook-form registered with register()", async () => {
    const user = userEvent.setup();
    const schema = z.object({ cost: moneyField() });
    const onValid = vi.fn();
    function Form() {
      const { register, handleSubmit } = useForm<
        z.input<typeof schema>,
        unknown,
        z.output<typeof schema>
      >({
        resolver: zodResolver(schema),
        defaultValues: { cost: "2,50" },
      });
      return (
        <form onSubmit={handleSubmit(onValid)}>
          <MoneyInput aria-label="Cena" {...register("cost")} />
          <button type="submit">Uložiť</button>
        </form>
      );
    }
    render(<Form />);
    const input = screen.getByLabelText("Cena");
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("3,50");
    expect(screen.queryByRole("button", { name: /Zvýšiť/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Uložiť" }));
    expect(onValid.mock.calls[0][0]).toEqual({ cost: 350 });
  });
});
