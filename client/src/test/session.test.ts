import { describe, expect, it } from "vitest";
import { sessionState } from "../state/session";

describe("sessionState", () => {
  it("has default values", () => {
    expect(sessionState.result).toBeNull();
    expect(sessionState.leaderboard).toEqual([]);
    expect(sessionState.selectedTrackId).toBeTruthy();
  });
});
