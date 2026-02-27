import { describe, expect, it, vi } from "vitest";
import { PauseScene } from "../scenes/PauseScene";

describe("PauseScene", () => {
  it("resumes race scene", () => {
    const pause = new PauseScene() as PauseScene & {
      scene: {
        resume: ReturnType<typeof vi.fn>;
        isPaused: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        start: ReturnType<typeof vi.fn>;
      };
    };
    pause.scene = {
      resume: vi.fn(),
      isPaused: vi.fn().mockReturnValue(true),
      stop: vi.fn(),
      start: vi.fn()
    };

    (pause as unknown as { resume: (from: string) => void }).resume("race");
    expect(pause.scene.resume).toHaveBeenCalledWith("race");
  });

  it("navigates to menu and level select", () => {
    const pause = new PauseScene() as PauseScene & {
      scene: {
        stop: ReturnType<typeof vi.fn>;
        start: ReturnType<typeof vi.fn>;
      };
    };
    pause.scene = {
      stop: vi.fn(),
      start: vi.fn()
    };

    (pause as unknown as { gotoMenu: (from: string) => void }).gotoMenu("race");
    expect(pause.scene.start).toHaveBeenCalledWith("menu");

    (pause as unknown as { gotoLevelSelect: (from: string) => void }).gotoLevelSelect("race");
    expect(pause.scene.start).toHaveBeenCalledWith("level_select");
  });
});
