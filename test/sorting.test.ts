import { describe, expect, it } from "vitest";
import { nextSort, normalizeSortValue, sortItems } from "../src/shared/sorting";

describe("sorting helpers", () => {
  it("starts a new sort key in ascending order", () => {
    expect(nextSort({ key: "name", direction: "desc" }, "date")).toEqual({
      key: "date",
      direction: "asc",
    });
  });

  it("toggles direction when sorting the same key again", () => {
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
  });

  it("sorts text with numeric awareness", () => {
    const sorted = sortItems(
      [{ ward: "Ward 10" }, { ward: "Ward 2" }, { ward: "Ward 1" }],
      { key: "ward", direction: "asc" },
      { ward: (item) => item.ward },
    );

    expect(sorted.map((item) => item.ward)).toEqual(["Ward 1", "Ward 2", "Ward 10"]);
  });

  it("normalizes dates and blank values before comparing", () => {
    expect(normalizeSortValue(new Date("2026-06-29T00:00:00Z"))).toBe(Date.parse("2026-06-29T00:00:00Z"));
    expect(normalizeSortValue(null)).toBe("");
    expect(normalizeSortValue(undefined)).toBe("");
  });
});
