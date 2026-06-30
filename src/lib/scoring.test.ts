import { describe, it, expect } from "vitest";
import { priorityFromScore, clamp, valueScore, rankScore, isDiyBuilder } from "./scoring";

describe("priorityFromScore", () => {
  it("maps high score -> HIGH, low score -> LOW", () => {
    expect(priorityFromScore(100)).toBe("HIGH");
    expect(priorityFromScore(71)).toBe("HIGH");
    expect(priorityFromScore(70)).toBe("MEDIUM");
    expect(priorityFromScore(41)).toBe("MEDIUM");
    expect(priorityFromScore(40)).toBe("LOW");
    expect(priorityFromScore(0)).toBe("LOW");
  });

  it("clamps out-of-range scores", () => {
    expect(priorityFromScore(250)).toBe("HIGH");
    expect(priorityFromScore(-10)).toBe("LOW");
  });
});

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(NaN, 1, 10)).toBe(1);
  });
});

describe("valueScore", () => {
  it("returns the neutral baseline when review data is absent", () => {
    expect(valueScore(null, null, null)).toBe(50);
  });

  it("rises with review count and rating", () => {
    const busy = valueScore(4.5, 200, null);
    const dead = valueScore(4.5, 2, null);
    expect(busy).toBeGreaterThan(dead);
    expect(busy).toBeLessThanOrEqual(100);
    expect(dead).toBeGreaterThanOrEqual(0);
  });

  it("adds a boost for DIY website builders", () => {
    expect(valueScore(null, null, "Wix")).toBe(60);
    expect(valueScore(null, null, "WordPress")).toBe(50);
  });
});

describe("rankScore", () => {
  it("ranks a busy bad site above a dead bad site above a busy good site", () => {
    const busyBad = rankScore(80, valueScore(4.5, 200, null));
    const deadBad = rankScore(80, valueScore(4.5, 2, null));
    const busyGood = rankScore(20, valueScore(4.5, 200, null));
    expect(busyBad).toBeGreaterThan(deadBad);
    expect(deadBad).toBeGreaterThan(busyGood);
  });
});

describe("isDiyBuilder", () => {
  it("flags owner-built platforms only", () => {
    expect(isDiyBuilder("Wix")).toBe(true);
    expect(isDiyBuilder("Squarespace")).toBe(true);
    expect(isDiyBuilder("WordPress")).toBe(false);
    expect(isDiyBuilder(null)).toBe(false);
  });
});
