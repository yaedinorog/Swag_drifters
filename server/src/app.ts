import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from "./socketEvents.js";
import { registerSocketHandlers } from "./socketHandlers.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: process.env.SOCKET_CORS_ORIGIN ?? "*" }
  });

  registerSocketHandlers(io);

  return httpServer;
}
