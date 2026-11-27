import { describe, expect, it } from "vitest";
import {
  addDays,
  hoursText,
  monthEnd,
  monthGrid,
  orderRange,
  sumHours,
  weekdayIndex,
  weekStart,
} from "./capacity";

describe("capacity calendar helpers", () => {
  it("weeks start on Monday", () => {
    expect(weekdayIndex("2026-06-01")).toBe(0); // Monday
    expect(weekdayIndex("2026-06-07")).toBe(6); // Sunday
    expect(weekStart("2026-06-18")).toBe("2026-06-15");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(monthEnd(2028, 2)).toBe("2028-02-29");
  });

  it("month grid: Monday-first weeks, days outside the month are empty", () => {
    const grid = monthGrid(2026, 11); // November 2026 starts on Sunday
    expect(grid[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(grid.at(-1)![0]).toBe("2026-11-30");
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });

  it("sums hours of a period and formats them with a comma", () => {
    const rows = [
      { day: "2026-06-01", available_hours: 8 },
      { day: "2026-06-02", available_hours: "7.5" },
      { day: "2026-06-08", available_hours: 8 },
    ];
    expect(sumHours(rows, "2026-06-01", "2026-06-07")).toBe(15.5);
    expect(hoursText(15.5)).toBe("15,5 h");
  });

  it("a backwards selection (Shift+click earlier day) is ordered", () => {
    expect(orderRange("2026-06-20", "2026-06-15")).toEqual(["2026-06-15", "2026-06-20"]);
  });
});
