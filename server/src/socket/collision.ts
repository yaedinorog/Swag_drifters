import type { PlayerState } from "./roomManager.js";

const CAR_RADIUS = 18;
const RESTITUTION = 0.6;

export function resolveCollisions(players: PlayerState[]): void {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (a.finished && b.finished) continue;

      const dx = b.carState.position.x - a.carState.position.x;
      const dy = b.carState.position.y - a.carState.position.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_RADIUS * 2;

      if (dist < minDist && dist > 0.001) {
        // Push apart
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;

        a.carState.position.x -= nx * overlap;
        a.carState.position.y -= ny * overlap;
        b.carState.position.x += nx * overlap;
        b.carState.position.y += ny * overlap;

        // Elastic impulse along collision normal
        const dvx = b.carState.velocity.x - a.carState.velocity.x;
        const dvy = b.carState.velocity.y - a.carState.velocity.y;
        const relNormal = dvx * nx + dvy * ny;

        if (relNormal < 0) {
          const impulse = relNormal * RESTITUTION;
          a.carState.velocity.x += impulse * nx;
          a.carState.velocity.y += impulse * ny;
          b.carState.velocity.x -= impulse * nx;
          b.carState.velocity.y -= impulse * ny;
        }
      }
    }
  }
}
