import type { CarState, InputState } from "./types.js";
import type { CarHandlingConfig } from "./carHandling.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stepDriftModel(
  current: CarState,
  input: InputState,
  dtSeconds: number,
  config: CarHandlingConfig,
  offTrack: boolean
): CarState {
  let velocityX = current.velocity.x;
  let velocityY = current.velocity.y;
  const initialForwardX = Math.cos(current.heading);
  const initialForwardY = Math.sin(current.heading);
  const initialForwardSpeed = velocityX * initialForwardX + velocityY * initialForwardY;

  const steerSpeedFactor = clamp(Math.abs(initialForwardSpeed) / 140, 0.2, 1);
  const steerTarget = input.steer * config.maxSteerRate * steerSpeedFactor;
  const handbrakeYawBoost = input.handbrake ? 1.55 : 1;
  const targetAngularVelocity = steerTarget * handbrakeYawBoost;
  const angularVelocity =
    current.angularVelocity +
    (targetAngularVelocity - current.angularVelocity) * config.turnResponse * dtSeconds;
  const heading = current.heading + angularVelocity * dtSeconds;

  const forwardX = Math.cos(heading);
  const forwardY = Math.sin(heading);

  velocityX += forwardX * input.throttle * config.acceleration * dtSeconds;
  velocityY += forwardY * input.throttle * config.acceleration * dtSeconds;

  const currentSpeed = Math.hypot(velocityX, velocityY);
  if (input.brake > 0) {
    const braking = input.brake * config.brakingForce * dtSeconds;
    if (currentSpeed > 0.001) {
      const speedAfterBrake = Math.max(0, currentSpeed - braking);
      velocityX *= speedAfterBrake / currentSpeed;
      velocityY *= speedAfterBrake / currentSpeed;
    }
  }

  const dragScale = Math.max(0, 1 - config.drag * dtSeconds);
  velocityX *= dragScale;
  velocityY *= dragScale;

  const signedForwardSpeed = velocityX * forwardX + velocityY * forwardY;
  const alignmentBase = input.handbrake
    ? config.driftGrip * config.handbrakeGripPenalty
    : config.baseGrip;
  const alignment = offTrack ? alignmentBase * 0.7 : alignmentBase;
  velocityX += (forwardX * signedForwardSpeed - velocityX) * alignment * dtSeconds;
  velocityY += (forwardY * signedForwardSpeed - velocityY) * alignment * dtSeconds;

  let speed = Math.hypot(velocityX, velocityY);
  if (speed > config.maxSpeed) {
    velocityX *= config.maxSpeed / speed;
    velocityY *= config.maxSpeed / speed;
    speed = config.maxSpeed;
  }

  if (offTrack) {
    velocityX *= config.offTrackDamping;
    velocityY *= config.offTrackDamping;
  }

  return {
    position: {
      x: current.position.x + velocityX * dtSeconds,
      y: current.position.y + velocityY * dtSeconds,
    },
    velocity: { x: velocityX, y: velocityY },
    heading,
    angularVelocity,
  };
}
