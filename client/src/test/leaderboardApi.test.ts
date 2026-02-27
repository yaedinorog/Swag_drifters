import { describe, expect, it } from "vitest";
import { formatTime } from "../services/api/leaderboardApi";

describe("formatTime", () => {
  it("formats zero correctly", () => {
    expect(formatTime(0)).toBe("00:00.000");
  });

  it("formats minutes, seconds, milliseconds", () => {
    expect(formatTime(61000)).toBe("01:01.000");
    expect(formatTime(61555)).toBe("01:01.555");
  });

  it("clamps invalid values", () => {
    expect(formatTime(-500)).toBe("00:00.000");
  });
});
