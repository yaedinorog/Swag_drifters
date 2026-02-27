import { describe, expect, it, vi } from "vitest";

vi.mock("../core/track/trackStore", () => ({
  getTracks: () => []
}));

import { LevelSelectScene } from "../scenes/LevelSelectScene";

describe("LevelSelectScene", () => {
  it("creates without tracks", () => {
    const scene = new LevelSelectScene() as LevelSelectScene & { scene: { start: ReturnType<typeof vi.fn> } };
    scene.scene = { start: vi.fn() };
    expect(() => scene.create()).not.toThrow();
  });

  it("refreshCards handles missing children", () => {
    const scene = new LevelSelectScene() as LevelSelectScene & { scene: { start: ReturnType<typeof vi.fn> } };
    scene.scene = { start: vi.fn() };
    (scene as unknown as { cards: { getAt: () => undefined }[] }).cards = [{ getAt: () => undefined }];
    expect(() => (scene as unknown as { refreshCards: () => void }).refreshCards()).not.toThrow();
  });
});
