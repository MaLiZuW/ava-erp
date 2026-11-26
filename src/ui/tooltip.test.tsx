import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("shows on hover and on keyboard focus, hides on leave / blur / Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Zákazky">
        {(tip) => (
          <a href="/zakazky/" aria-label="Zákazky" {...tip}>
            Z
          </a>
        )}
      </Tooltip>,
    );
    const link = screen.getByRole("link", { name: "Zákazky" });
    await user.hover(link);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Zákazky");
    await user.unhover(link);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab();
    expect(link).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders nothing when disabled (expanded menu shows the label)", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Zákazky" enabled={false}>
        {(tip) => (
          <a href="/zakazky/" {...tip}>
            Zákazky
          </a>
        )}
      </Tooltip>,
    );
    await user.hover(screen.getByRole("link"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
