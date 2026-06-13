import type { Server } from "socket.io";
import { DEFAULT_HANDLING, TURBO_HANDLING } from "../physics/carHandling.js";
import { stepDriftModel } from "../physics/driftModel.js";
import { isOnTrackFromGeometry } from "../track/geometry.js";
import { LapTracker } from "../track/lapTracker.js";
import { resolveCollisions } from "./collision.js";
import type { Room } from "./roomManager.js";

const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;
const SNAPSHOT_EVERY = 2;
const TOTAL_LAPS = 3;

const activeLoops = new Map<string, ReturnType<typeof setInterval>>();

export function startGameLoop(io: Server, room: Room, raceStartMs: number): void {
  stopGameLoop(room.code);

  for (const player of room.players.values()) {
    player.raceStartMs = raceStartMs;
    player.lapTracker = new LapTracker(room.track!.checkpoints, raceStartMs, TOTAL_LAPS);
  }

  let tick = 0;
  let seq = 0;
  const DT = TICK_MS / 1000;

  const interval = setInterval(() => {
    if (room.phase !== "racing") {
      stopGameLoop(room.code);
      return;
    }

    const now = Date.now();
    const activePlayers = Array.from(room.players.values()).filter((p) => !p.finished);

    for (const player of activePlayers) {
      const inp = player.lastInput;
      const input = {
        throttle: inp.throttle,
        brake: inp.brake,
        steer: inp.steer,
        handbrake: inp.handbrake,
      };
      const handling = inp.turbo ? TURBO_HANDLING : DEFAULT_HANDLING;
      const prevPos = { ...player.carState.position };
      const offTrack = !isOnTrackFromGeometry(player.carState.position.x, player.carState.position.y, room.trackGeometry!);

      player.carState = stepDriftModel(player.carState, input, DT, handling, offTrack);

      const result = player.lapTracker!.update(prevPos, player.carState.position, now);
      player.lapNumber = result.lapState.lapNumber;

      if (result.lapCompleted && result.completedLapTimeMs !== null) {
        io.to(room.code).emit("lapComplete", {
          playerId: player.socketId,
          lapNumber: result.lapState.lapNumber - 1,
          lapTimeMs: result.completedLapTimeMs,
        });
      }

      if (result.raceCompleted) {
        player.finished = true;
        room.finishCount++;
        player.totalTimeMs = now - player.raceStartMs;
        player.finishPosition = room.finishCount;

        io.to(room.code).emit("playerFinished", {
          playerId: player.socketId,
          totalTimeMs: player.totalTimeMs,
          position: player.finishPosition,
        });

        const allDone = Array.from(room.players.values()).every((p) => p.finished);
        if (allDone) {
          room.phase = "results";
          const results = Array.from(room.players.values())
            .sort((a, b) => a.finishPosition - b.finishPosition)
            .map((p) => ({
              playerId: p.socketId,
              playerName: p.playerName,
              position: p.finishPosition,
              totalTimeMs: p.totalTimeMs,
            }));
          io.to(room.code).emit("raceEnd", { results, hostId: room.hostId });
          stopGameLoop(room.code);
          return;
        }
      }
    }

    resolveCollisions(Array.from(room.players.values()));

    if (tick % SNAPSHOT_EVERY === 0) {
      const cars = Array.from(room.players.values()).map((p) => ({
        id: p.socketId,
        x: p.carState.position.x,
        y: p.carState.position.y,
        heading: p.carState.heading,
        vx: p.carState.velocity.x,
        vy: p.carState.velocity.y,
        angularVelocity: p.carState.angularVelocity,
        lapNumber: p.lapNumber,
        finished: p.finished,
        lastInputSeq: p.lastInputSeq,
      }));
      io.to(room.code).emit("snapshot", { seq: seq++, serverTime: now, cars });
    }

    tick++;
  }, TICK_MS);

  activeLoops.set(room.code, interval);
}

export function stopGameLoop(code: string): void {
  const interval = activeLoops.get(code);
  if (interval) {
    clearInterval(interval);
    activeLoops.delete(code);
  }
}
