import { describe, expect, it, vi } from "vitest";
import { MenuScene } from "../scenes/MenuScene";

describe("MenuScene", () => {
  it("starts level select when clicking button", () => {
    const scene = new MenuScene() as MenuScene & { scene: { start: ReturnType<typeof vi.fn> } };
    scene.scene = { start: vi.fn() };
    scene.create();

    const button = (scene as unknown as { levelSelectButton?: { emit: (event: string) => void } })
      .levelSelectButton;
    expect(button).toBeTruthy();
    button?.emit("pointerdown");

    expect(scene.scene.start).toHaveBeenCalledWith("level_select");
  });
});
