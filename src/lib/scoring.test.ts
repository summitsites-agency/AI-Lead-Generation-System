import { describe, it, expect } from "vitest";
import { priorityFromScore, clamp } from "./scoring";

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
