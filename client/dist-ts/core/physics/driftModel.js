function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function stepDriftModel(current, input, dtSeconds, config, offTrack) {
    let velocityX = current.velocity.x;
    let velocityY = current.velocity.y;
    const initialForwardX = Math.cos(current.heading);
    const initialForwardY = Math.sin(current.heading);
    const initialForwardSpeed = velocityX * initialForwardX + velocityY * initialForwardY;
    const steerSpeedFactor = clamp(Math.abs(initialForwardSpeed) / 140, 0.2, 1);
    const steerTarget = input.steer * config.maxSteerRate * steerSpeedFactor;
    const handbrakeYawBoost = input.handbrake ? 1.55 : 1;
    const targetAngularVelocity = steerTarget * handbrakeYawBoost;
    const angularVelocity = current.angularVelocity +
        (targetAngularVelocity - current.angularVelocity) * config.turnResponse * dtSeconds;
    const heading = current.heading + angularVelocity * dtSeconds;
    const forwardX = Math.cos(heading);
    const forwardY = Math.sin(heading);
    const rightX = -forwardY;
    const rightY = forwardX;
    const throttleForce = input.throttle * config.acceleration;
    velocityX += forwardX * throttleForce * dtSeconds;
    velocityY += forwardY * throttleForce * dtSeconds;
    const currentSpeed = Math.hypot(velocityX, velocityY);
    if (input.brake > 0) {
        const braking = input.brake * config.brakingForce * dtSeconds;
        if (currentSpeed > 0.001) {
            const speedAfterBrake = Math.max(0, currentSpeed - braking);
            const scale = speedAfterBrake / currentSpeed;
            velocityX *= scale;
            velocityY *= scale;
        }
    }
    const dragScale = Math.max(0, 1 - config.drag * dtSeconds);
    velocityX *= dragScale;
    velocityY *= dragScale;
    // Ice-like behavior: velocity keeps sliding, then gradually aligns with car heading.
    const signedForwardSpeed = velocityX * forwardX + velocityY * forwardY;
    const targetVelocityX = forwardX * signedForwardSpeed;
    const targetVelocityY = forwardY * signedForwardSpeed;
    const alignmentBase = input.handbrake
        ? config.driftGrip * config.handbrakeGripPenalty
        : config.baseGrip;
    const alignment = offTrack ? alignmentBase * 0.7 : alignmentBase;
    velocityX += (targetVelocityX - velocityX) * alignment * dtSeconds;
    velocityY += (targetVelocityY - velocityY) * alignment * dtSeconds;
    let speed = Math.hypot(velocityX, velocityY);
    if (speed > config.maxSpeed) {
        const scale = config.maxSpeed / speed;
        velocityX *= scale;
        velocityY *= scale;
        speed = config.maxSpeed;
    }
    if (offTrack) {
        velocityX *= config.offTrackDamping;
        velocityY *= config.offTrackDamping;
        speed *= config.offTrackDamping;
    }
    const nextState = {
        position: {
            x: current.position.x + velocityX * dtSeconds,
            y: current.position.y + velocityY * dtSeconds
        },
        velocity: { x: velocityX, y: velocityY },
        heading,
        angularVelocity
    };
    const lateral = velocityX * rightX + velocityY * rightY;
    return {
        state: nextState,
        speed,
        isDrifting: Math.abs(lateral) > config.driftThreshold,
        lateralVelocity: lateral
    };
}
