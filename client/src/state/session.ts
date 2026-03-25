import type { LeaderboardEntry, RaceResult } from "../core/types";
import { DEFAULT_TRACK_ID } from "../core/constants";
import type { TrackResult } from "../services/socketEvents";

export interface ResultScreenState extends RaceResult {
  trackId: string;
}

export interface OnlineState {
  active: boolean;
  roomId: string | null;
  mySocketId: string | null;
  players: { socketId: string; nickname: string }[];
  trackList: string[];
  currentTrackIndex: number;
  laps: number;
  sessionScores: Record<string, number>;
  lastTrackResults: TrackResult[];
}

export const sessionState: {
  result: ResultScreenState | null;
  leaderboard: LeaderboardEntry[];
  selectedTrackId: string;
  online: OnlineState | null;
} = {
  result: null,
  leaderboard: [],
  selectedTrackId: DEFAULT_TRACK_ID,
  online: null
};
