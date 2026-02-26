import type { LeaderboardEntry, RaceResult } from "../core/types";
import { DEFAULT_TRACK_ID } from "../core/constants";

export interface ResultScreenState extends RaceResult {
  trackId: string;
}

export const sessionState: {
  result: ResultScreenState | null;
  leaderboard: LeaderboardEntry[];
  selectedTrackId: string;
} = {
  result: null,
  leaderboard: [],
  selectedTrackId: DEFAULT_TRACK_ID
};
