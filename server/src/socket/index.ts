import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { getTrack, getDefaultTrackId, loadAllTracks, getTrackIds } from "../track/trackLoader.js";
import {
  getOrCreateRoom,
  getRoom,
  addPlayer,
  removePlayer,
  assignSpawns,
  resetForNextRound,
  getRoomBySocketId,
  deleteRoom,
} from "./roomManager.js";
import { startGameLoop, stopGameLoop } from "./gameLoop.js";

const COUNTDOWN_MS = 3000;
const MAX_PLAYERS = 6;

export function attachSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // Pre-load tracks at startup
  loadAllTracks().catch(console.error);

  io.on("connection", (socket) => {
    // ── Join room ─────────────────────────────────────────────────
    socket.on("joinRoom", async ({ code, playerName }: { code: string; playerName: string }) => {
      const trimCode = String(code).trim().slice(0, 4);
      const trimName = String(playerName).trim().slice(0, 20) || "Player";

      const room = getOrCreateRoom(trimCode);

      if (room.players.size >= MAX_PLAYERS) {
        socket.emit("joinError", { message: "Room is full" });
        return;
      }
      if (room.phase === "racing") {
        socket.emit("joinError", { message: "Race in progress" });
        return;
      }

      // Ensure track is loaded
      if (!room.track) {
        const defaultId = await getDefaultTrackId();
        room.trackId = defaultId;
        room.track = (await getTrack(defaultId)) ?? null;
      }

      await socket.join(trimCode);
      const player = addPlayer(room, socket.id, trimName);

      // Tell everyone a new player joined
      socket.to(trimCode).emit("playerJoined", {
        id: socket.id,
        playerName: trimName,
        isHost: false,
      });

      // Send current room state to the new player
      socket.emit("roomState", {
        code: trimCode,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.socketId,
          playerName: p.playerName,
          isHost: p.isHost,
        })),
        hostId: room.hostId,
        trackId: room.trackId,
        phase: room.phase,
        availableTracks: getTrackIds(),
      });

      console.log(`[room ${trimCode}] ${trimName} joined (${room.players.size}/${MAX_PLAYERS})`);
    });

    // ── Player input ─────────────────────────────────────────────
    socket.on("playerInput", (input: {
      seq: number;
      throttle: number;
      brake: number;
      steer: number;
      handbrake: boolean;
      turbo: boolean;
    }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room || room.phase !== "racing") return;
      const player = room.players.get(socket.id);
      if (!player || player.finished) return;

      player.lastInputSeq = typeof input.seq === "number" ? input.seq : player.lastInputSeq;
      player.lastInput = {
        throttle: clamp01(input.throttle),
        brake: clamp01(input.brake),
        steer: clampSigned(input.steer),
        handbrake: Boolean(input.handbrake),
        turbo: Boolean(input.turbo),
      };
    });

    // ── Host: pick track ─────────────────────────────────────────
    socket.on("pickTrack", async ({ trackId }: { trackId: string }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.phase !== "lobby" && room.phase !== "results") return;

      const track = await getTrack(trackId);
      if (!track) return;

      room.trackId = trackId;
      room.track = track;
      io.to(room.code).emit("trackChanged", { trackId });
    });

    // ── Host: start race ──────────────────────────────────────────
    socket.on("startRace", async () => {
      const room = getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.phase !== "lobby" && room.phase !== "results") return;
      if (room.players.size < 1) return;

      if (room.phase === "results") resetForNextRound(room);

      room.phase = "countdown";
      const spawnPositions = assignSpawns(room);

      io.to(room.code).emit("startCountdown", {
        trackId: room.trackId,
        spawnPositions,
      });

      setTimeout(() => {
        if (room.phase !== "countdown") return;
        // Guard: room may have been deleted if all players disconnected during countdown
        if (!getRoom(room.code)) return;
        room.phase = "racing";
        const raceStartMs = Date.now();
        io.to(room.code).emit("raceStart", { serverTime: raceStartMs });
        startGameLoop(io, room, raceStartMs);
      }, COUNTDOWN_MS);
    });

    // ── Disconnect ────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const room = getRoomBySocketId(socket.id);
      if (!room) return;

      const player = room.players.get(socket.id);
      const wasHost = player?.isHost ?? false;

      removePlayer(room, socket.id);

      if (room.players.size === 0) {
        stopGameLoop(room.code);
        deleteRoom(room.code);
        console.log(`[room ${room.code}] destroyed (empty)`);
        return;
      }

      io.to(room.code).emit("playerLeft", { id: socket.id });

      if (wasHost) {
        io.to(room.code).emit("hostChanged", { hostId: room.hostId });
      }

      // If racing and all remaining players finished, end race
      if (room.phase === "racing") {
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
        }
      }

      console.log(`[room ${room.code}] ${player?.playerName} left`);
    });
  });

  return io;
}

function clamp01(v: unknown): number {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

function clampSigned(v: unknown): number {
  return Math.min(1, Math.max(-1, Number(v) || 0));
}
