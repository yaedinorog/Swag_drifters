import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  TrackResult,
  PodiumEntry
} from "./socketEvents.js";
import {
  createRoom,
  getRoom,
  getRoomBySocket,
  joinRoom,
  leaveRoom,
  listPublicRooms,
  toSnapshot
} from "./rooms.js";
import type { RoomState } from "./rooms.js";

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function pickRandomTracks(ids: string[], count: number): string[] {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function finalizeTrack(room: RoomState, io: AppServer): void {
  const finishers = [...room.finishTimes.entries()];
  const avgTime =
    finishers.length > 0
      ? finishers.reduce((s, [, t]) => s + t, 0) / finishers.length
      : 0;

  const results: TrackResult[] = [];
  for (const [socketId, nickname] of room.players.entries()) {
    const timeMs = room.finishTimes.get(socketId) ?? null;
    const skillRate =
      timeMs != null && avgTime > 0 ? (avgTime / timeMs) * 100 : 0;
    const prev = room.sessionScores.get(socketId) ?? 0;
    room.sessionScores.set(socketId, prev + skillRate);
    results.push({ socketId, nickname, timeMs, skillRate });
  }

  io.to(room.id).emit("track_results", results);

  room.finishTimes.clear();
  room.readySet.clear();
  room.status = "results";
  room.currentTrackIndex++;

  if (room.currentTrackIndex < room.trackList.length) {
    setTimeout(() => {
      io.to(room.id).emit("load_next_track", {
        trackId: room.trackList[room.currentTrackIndex]!
      });
    }, 10_000);
  } else {
    const ranked: PodiumEntry[] = [...room.sessionScores.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([socketId, totalScore]) => ({
        socketId,
        nickname: room.players.get(socketId) ?? "Unknown",
        totalScore
      }));
    setTimeout(() => {
      io.to(room.id).emit("session_podium", { rankedPlayers: ranked });
    }, 10_000);
  }
}

function startDnfTimer(room: RoomState, io: AppServer): void {
  let remaining = 30;
  const tick = () => {
    remaining--;
    if (remaining <= 10) {
      io.to(room.id).emit("dnf_warning", { secondsLeft: remaining });
    }
    if (remaining <= 0) {
      finalizeTrack(room, io);
    } else {
      room.dnfTimer = setTimeout(tick, 1000);
    }
  };
  room.dnfTimer = setTimeout(tick, 1000);
}

export function registerSocketHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    socket.data.roomId = null;

    socket.on("list_rooms", () => {
      socket.emit("rooms_list", listPublicRooms());
    });

    socket.on("create_room", ({ nickname, settings }, cb) => {
      socket.data.nickname = nickname;
      const room = createRoom(socket.id, nickname, settings);
      socket.data.roomId = room.id;
      socket.join(room.id);
      cb(toSnapshot(room));
    });

    socket.on("join_room", ({ roomId, nickname }, cb) => {
      const room = getRoom(roomId);
      if (!room || room.status !== "waiting" || room.players.size >= 8) {
        return cb({ ok: false, error: "Room unavailable" });
      }
      socket.data.nickname = nickname;
      socket.data.roomId = roomId;
      joinRoom(room, socket.id, nickname);
      socket.join(roomId);
      socket.to(roomId).emit("player_joined", { socketId: socket.id, nickname });
      cb({ ok: true, room: toSnapshot(room) });
    });

    socket.on("launch_game", ({ availableTrackIds }) => {
      const room = getRoomBySocket(socket.id);
      if (!room || room.hostSocketId !== socket.id) return;
      room.trackList = pickRandomTracks(availableTrackIds, room.settings.trackCount);
      room.currentTrackIndex = 0;
      room.status = "loading";
      io.to(room.id).emit("game_starting", {
        trackList: room.trackList,
        settings: room.settings
      });
    });

    socket.on("ready_to_race", () => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.readySet.add(socket.id);
      if (room.readySet.size >= room.players.size) {
        io.to(room.id).emit("countdown_start");
        setTimeout(() => {
          room.status = "racing";
          io.to(room.id).emit("race_go");
        }, 3000);
      }
    });

    socket.on("update_position", (data) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.volatile.to(roomId).emit("player_moved", {
        socketId: socket.id,
        ...data
      });
    });

    socket.on("race_finished", ({ timeMs }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      room.finishTimes.set(socket.id, timeMs);
      io.to(room.id).emit("player_finished", { socketId: socket.id, timeMs });

      if (room.finishTimes.size === 1) {
        startDnfTimer(room, io);
      }
      if (room.finishTimes.size >= room.players.size) {
        clearTimeout(room.dnfTimer);
        finalizeTrack(room, io);
      }
    });

    socket.on("pause_request", () => {
      const room = getRoomBySocket(socket.id);
      if (!room || room.status !== "racing") return;
      room.status = "paused";
      io.to(room.id).emit("game_paused", { bySocketId: socket.id });
    });

    socket.on("resume_request", () => {
      const room = getRoomBySocket(socket.id);
      if (!room || room.status !== "paused") return;
      room.status = "racing";
      io.to(room.id).emit("game_resumed");
    });

    socket.on("disconnecting", () => {
      const { room, newHostId } = leaveRoom(socket.id);
      if (room) {
        socket.to(room.id).emit("player_left", {
          socketId: socket.id,
          newHostId
        });
      }
    });
  });
}
