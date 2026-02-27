import { describe, expect, it } from "vitest";
import { stepDriftModel } from "../core/physics/driftModel";
import { carHandling } from "../core/physics/carHandling";
import type { CarState, InputState } from "../core/types";

const baseState: CarState = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  heading: 0,
  angularVelocity: 0
};

const noInput: InputState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false
};

describe("stepDriftModel", () => {
  it("accelerates on throttle", () => {
    const result = stepDriftModel(baseState, { ...noInput, throttle: 1 }, 1, carHandling, false);
    expect(result.speed).toBeGreaterThan(0);
  });

  it("brakes reduce speed", () => {
    const moving: CarState = {
      ...baseState,
      velocity: { x: 200, y: 0 }
    };
    const result = stepDriftModel(moving, { ...noInput, brake: 1 }, 1, carHandling, false);
    expect(result.speed).toBeLessThan(200);
  });

  it("off-track damping reduces speed", () => {
    const moving: CarState = {
      ...baseState,
      velocity: { x: 200, y: 0 }
    };
    const onTrack = stepDriftModel(moving, noInput, 1, carHandling, false);
    const offTrack = stepDriftModel(moving, noInput, 1, carHandling, true);
    expect(offTrack.speed).toBeLessThan(onTrack.speed);
  });
});
