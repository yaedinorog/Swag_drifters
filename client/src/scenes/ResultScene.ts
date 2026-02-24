import Phaser from "phaser";
import { GAME_WIDTH } from "../core/constants";
import { fetchLeaderboard, formatTime, submitScore } from "../services/api/leaderboardApi";
import { sessionState } from "../state/session";

export class ResultScene extends Phaser.Scene {
  private leaderboardText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("result");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b1222");
    const result = sessionState.result;
    if (!result) {
      this.scene.start("menu");
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 90, "RACE COMPLETE", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#93c5fd"
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        180,
        `Final Time: ${formatTime(result.finalTimeMs)}\nBest Lap: ${formatTime(result.bestLapMs)}`,
        {
          fontFamily: "monospace",
          fontSize: "30px",
          align: "center",
          color: "#f8fafc"
        }
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, 290, "Press [S] to submit score", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#fcd34d"
      })
      .setOrigin(0.5);

    this.leaderboardText = this.add.text(120, 340, "Loading leaderboard...", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#e5e7eb",
      lineSpacing: 8
    });

    this.refreshLeaderboard(result.trackId);

    this.input.keyboard?.on("keydown-S", () => this.trySubmit());
    this.input.keyboard?.on("keydown-R", () => this.scene.start("race"));
    this.input.keyboard?.on("keydown-M", () => this.scene.start("menu"));

    this.add
      .text(GAME_WIDTH / 2, 650, "[S] Submit score   [R] Retry   [M] Menu", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#d1d5db"
      })
      .setOrigin(0.5);
  }

  private async refreshLeaderboard(trackId: string): Promise<void> {
    try {
      const rows = await fetchLeaderboard(trackId, 10);
      sessionState.leaderboard = rows;
      const lines = rows.length
        ? rows.map((entry, index) => `${index + 1}. ${entry.playerName.padEnd(16)} ${formatTime(entry.timeMs)}`)
        : ["No records yet."];
      this.leaderboardText.setText(["Top 10", "------------------------------", ...lines].join("\n"));
    } catch (error) {
      this.leaderboardText.setText("Leaderboard unavailable.");
      console.error(error);
    }
  }

  private async trySubmit(): Promise<void> {
    const result = sessionState.result;
    if (!result) {
      return;
    }

    const raw = window.prompt("Enter player name (3-16 chars):", "RACER");
    if (!raw) {
      return;
    }
    const name = raw.trim();
    if (!/^[A-Za-z0-9_ ]{3,16}$/.test(name)) {
      this.statusText.setText("Invalid name format.");
      return;
    }

    this.statusText.setText("Submitting...");
    try {
      await submitScore(name, result.trackId, result.finalTimeMs);
      this.statusText.setText("Score submitted.");
      await this.refreshLeaderboard(result.trackId);
    } catch (error) {
      this.statusText.setText("Submit failed.");
      console.error(error);
    }
  }
}
