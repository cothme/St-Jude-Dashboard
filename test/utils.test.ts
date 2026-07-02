import { describe, expect, it, vi } from "vitest";
import { ageFromBirthDate, calculateBmi, nextId } from "../src/utils";

describe("utility helpers", () => {
  it("calculates BMI to two decimal places", () => {
    expect(calculateBmi(72, 180)).toBe(22.22);
  });

  it("returns undefined when BMI inputs are incomplete", () => {
    expect(calculateBmi(undefined, 180)).toBeUndefined();
    expect(calculateBmi(72, undefined)).toBeUndefined();
  });

  it("returns the next numeric id from a collection", () => {
    expect(nextId([{ id: 3 }, { id: 9 }, { id: 4 }])).toBe(10);
    expect(nextId([])).toBe(1);
  });

  it("calculates age relative to the current date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-29T12:00:00Z"));

    expect(ageFromBirthDate("2000-06-30")).toBe(25);
    expect(ageFromBirthDate("2000-06-29")).toBe(26);

    vi.useRealTimers();
  });
});
