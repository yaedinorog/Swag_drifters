import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import type { LeaderboardEntry } from "../../core/types";
import { db } from "../firebase";

function scoresCol(trackId: string) {
  return collection(db, "leaderboard", trackId, "scores");
}

function scoreDoc(trackId: string, playerName: string) {
  return doc(db, "leaderboard", trackId, "scores", playerName);
}

export async function getTopScores(trackId: string, topLimit = 5): Promise<LeaderboardEntry[]> {
  const q = query(scoresCol(trackId), orderBy("timeMs", "asc"), limit(topLimit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      playerName: data.playerName as string,
      timeMs: data.timeMs as number,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString()
    };
  });
}

export async function getPlayerBest(
  playerName: string,
  trackId: string
): Promise<LeaderboardEntry | null> {
  const snap = await getDoc(scoreDoc(trackId, playerName));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    playerName: data.playerName as string,
    timeMs: data.timeMs as number,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString()
  };
}

export async function submitScore(
  playerName: string,
  trackId: string,
  timeMs: number
): Promise<void> {
  const ref = scoreDoc(trackId, playerName);
  const existing = await getDoc(ref);

  if (existing.exists() && (existing.data().timeMs as number) <= timeMs) {
    return; // existing record is already equal or better
  }

  await setDoc(ref, { playerName, timeMs, createdAt: serverTimestamp() });
}
