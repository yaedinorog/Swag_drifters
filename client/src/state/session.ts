import type { LeaderboardEntry, RaceResult } from "../core/types";

export interface ResultScreenState extends RaceResult {
  trackId: string;
}

export const sessionState: {
  result: ResultScreenState | null;
  leaderboard: LeaderboardEntry[];
} = {
  result: null,
  leaderboard: []
};
