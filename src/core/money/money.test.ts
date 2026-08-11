import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { add, formatMoney, isOverdrawn, progress, toStorage } from ".";

describe("money never uses binary floating point", () => {
  it("adds cents exactly", () => {
    // 0.1 + 0.2 !== 0.3 in float. A budget that drifts by a centavo per
    // addition is a budget the user stops trusting (decision A10).
    expect(add("0.10", "0.20").equals(new Decimal("0.30"))).toBe(true);
  });

  it("keeps a long running total exact", () => {
    const many = Array.from({ length: 100 }, () => "0.01");
    expect(toStorage(add(...many))).toBe("1.00");
  });

  it("stores a fixed two-decimal string, never a number", () => {
    expect(toStorage(1240)).toBe("1240.00");
    expect(typeof toStorage(1240)).toBe("string");
  });
});

describe("formatting matches the mockup", () => {
  it("drops decimals on whole amounts and separates thousands", () => {
    expect(formatMoney(3580)).toBe("₱3,580");
    expect(formatMoney(12400)).toBe("₱12,400");
  });

  it("keeps decimals when they carry information", () => {
    expect(formatMoney("1240.50")).toBe("₱1,240.50");
  });

  it("marks a negative amount rather than hiding it", () => {
    // Product spec §9: overdrawn must read as a warning state, not as a
    // number the user might skim past.
    expect(formatMoney(-420)).toBe("−₱420");
    expect(isOverdrawn(-0.01)).toBe(true);
    expect(isOverdrawn(0)).toBe(false);
  });
});

describe("progress does not cap an overspend", () => {
  it("reports over 100% when the cap is exceeded", () => {
    // Product spec §8 and §9 both want over to read as over, not as a
    // conveniently full bar.
    expect(progress(120, 100)).toBeCloseTo(1.2);
  });

  it("treats a zero cap as no progress rather than dividing by zero", () => {
    expect(progress(50, 0)).toBe(0);
  });
});
