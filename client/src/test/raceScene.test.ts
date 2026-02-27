import { describe, expect, it, vi } from "vitest";
import { RaceScene } from "../scenes/RaceScene";

describe("RaceScene", () => {
  it("opens pause scene", () => {
    const race = new RaceScene();
    (race as unknown as { scene: { launch: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; isActive: ReturnType<typeof vi.fn>; isPaused: ReturnType<typeof vi.fn>; } }).scene = {
      launch: vi.fn(),
      pause: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
      isPaused: vi.fn().mockReturnValue(false)
    };

    (race as unknown as { openPause: () => void }).openPause();
    expect((race as unknown as { scene: { launch: ReturnType<typeof vi.fn> } }).scene.launch).toHaveBeenCalledWith("pause", { from: "race" });
    expect((race as unknown as { scene: { pause: ReturnType<typeof vi.fn> } }).scene.pause).toHaveBeenCalled();
  });
});
