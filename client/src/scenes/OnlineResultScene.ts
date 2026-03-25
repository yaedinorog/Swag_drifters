import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
import { formatTime } from "../services/api/leaderboardApi";
import { getSocket, disconnectSocket } from "../services/socket";
import type { TrackResult } from "../services/socketEvents";
import { sessionState } from "../state/session";

export class OnlineResultScene extends Phaser.Scene {
  private elements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("online_result");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b1222");
    this.elements = [];

    const online = sessionState.online;
    if (!online) {
      this.scene.start("menu");
      return;
    }

    this.showTrackResults(online.lastTrackResults);
    this.listenForNext();
  }

  shutdown(): void {
    try {
      const socket = getSocket();
      socket.off("load_next_track");
      socket.off("session_podium");
    } catch {
      // socket may be gone
    }
    this.elements.forEach((el) => el.destroy());
    this.elements = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.elements.push(obj);
    return obj;
  }

  private showTrackResults(results: TrackResult[]): void {
    this.track(
      this.add
        .text(GAME_WIDTH / 2, 55, "TRACK RESULTS", {
          fontFamily: "monospace",
          fontSize: "44px",
          color: "#22d3ee"
        })
        .setOrigin(0.5)
    );

    const sorted = [...results].sort((a, b) => {
      if (a.timeMs === null) return 1;
      if (b.timeMs === null) return -1;
      return a.timeMs - b.timeMs;
    });

    let y = 130;
    for (const r of sorted) {
      const timeStr = r.timeMs != null ? formatTime(r.timeMs) : "DNF";
      this.track(
        this.add.text(GAME_WIDTH / 2, y, `${r.nickname.padEnd(18)} ${timeStr}`, {
          fontFamily: "monospace",
          fontSize: "28px",
          color: r.timeMs != null ? "#e5e7eb" : "#6b7280"
        }).setOrigin(0.5)
      );
      y += 44;
    }

    // After 3s: show skill-rate breakdown
    this.time.delayedCall(3000, () => {
      const avgTime =
        results.filter((r) => r.timeMs != null).reduce((s, r) => s + r.timeMs!, 0) /
        (results.filter((r) => r.timeMs != null).length || 1);

      this.track(
        this.add
          .text(GAME_WIDTH / 2, y + 20, `Avg: ${formatTime(Math.round(avgTime))}`, {
            fontFamily: "monospace",
            fontSize: "22px",
            color: "#9ca3af"
          })
          .setOrigin(0.5)
      );

      y += 60;
      for (const r of sorted) {
        const pts = Math.round(r.skillRate);
        const skillText = this.add
          .text(GAME_WIDTH / 2, y, `${r.nickname}  ${pts} pts`, {
            fontFamily: "monospace",
            fontSize: "24px",
            color: pts > 100 ? "#86efac" : "#d1d5db"
          })
          .setOrigin(0.5)
          .setAlpha(0);
        this.track(skillText);
        this.tweens.add({ targets: skillText, alpha: 1, duration: 600 });
        y += 36;
      }

      this.track(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 55, "Next track loading in 10s...", {
            fontFamily: "monospace",
            fontSize: "20px",
            color: "#6b7280"
          })
          .setOrigin(0.5)
      );
    });
  }

  private showPodium(rankedPlayers: { socketId: string; nickname: string; totalScore: number }[]): void {
    this.elements.forEach((el) => el.destroy());
    this.elements = [];

    this.track(
      this.add
        .text(GAME_WIDTH / 2, 60, "FINAL STANDINGS", {
          fontFamily: "monospace",
          fontSize: "48px",
          color: "#ffd166"
        })
        .setOrigin(0.5)
    );

    let y = 150;
    for (let i = 0; i < rankedPlayers.length; i++) {
      const p = rankedPlayers[i]!;
      const color = i === 0 ? "#ffd166" : i === 1 ? "#d1d5db" : i === 2 ? "#f97316" : "#9ca3af";
      this.track(
        this.add
          .text(GAME_WIDTH / 2, y, `#${i + 1}  ${p.nickname}  —  ${Math.round(p.totalScore)} pts`, {
            fontFamily: "monospace",
            fontSize: i === 0 ? 32 : 26,
            color
          })
          .setOrigin(0.5)
      );
      y += i === 0 ? 52 : 40;
    }

    if (rankedPlayers[0]) {
      this.track(
        this.add
          .text(GAME_WIDTH / 2, y + 20, `Winner: ${rankedPlayers[0].nickname}!`, {
            fontFamily: "monospace",
            fontSize: "36px",
            color: "#ffd166"
          })
          .setOrigin(0.5)
      );
    }

    const backBtn = this.track(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 80, "[ BACK TO LOBBY ]", {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#22d3ee",
          backgroundColor: "#172034",
          padding: { left: 14, right: 14, top: 8, bottom: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
    ) as Phaser.GameObjects.Text;

    backBtn.on("pointerdown", () => {
      sessionState.online = null;
      disconnectSocket();
      this.scene.start("menu");
    });

    // Auto-return after 15s
    this.time.delayedCall(15_000, () => {
      if (this.scene.isActive("online_result")) {
        sessionState.online = null;
        disconnectSocket();
        this.scene.start("menu");
      }
    });
  }

  private listenForNext(): void {
    const socket = getSocket();

    socket.once("load_next_track", ({ trackId }) => {
      socket.off("session_podium");
      if (!sessionState.online) return;
      sessionState.online.currentTrackIndex++;
      // Ensure the trackId matches what server sent
      const idx = sessionState.online.trackList.indexOf(trackId);
      if (idx >= 0) sessionState.online.currentTrackIndex = idx;
      this.scene.start("race", { onlineMode: true });
    });

    socket.once("session_podium", ({ rankedPlayers }) => {
      socket.off("load_next_track");
      this.showPodium(rankedPlayers);
    });
  }
}
