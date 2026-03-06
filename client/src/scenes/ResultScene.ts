import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
import { getPlayerBest, getTopScores, submitScore } from "../services/firestore/leaderboardService";
import { formatTime } from "../services/api/leaderboardApi";
import { clearPlayerName, getPlayerName, setPlayerName } from "../state/playerProfile";
import { sessionState } from "../state/session";

const NAME_PATTERN = /^[A-Za-z0-9_ ]{3,16}$/;

export class ResultScene extends Phaser.Scene {
  private leaderboardText!: Phaser.GameObjects.Text;
  private playerBestText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private nameDialog: HTMLDivElement | null = null;

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
      .text(GAME_WIDTH / 2, 55, "RACE COMPLETE", {
        fontFamily: "monospace",
        fontSize: "44px",
        color: "#93c5fd"
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        130,
        `Time: ${formatTime(result.finalTimeMs)}   Best Lap: ${formatTime(result.bestLapMs)}   Avg: ${result.averageSpeedKmh} km/h`,
        {
          fontFamily: "monospace",
          fontSize: "26px",
          align: "center",
          color: "#f8fafc"
        }
      )
      .setOrigin(0.5);

    this.add
      .text(120, 185, "\u2500\u2500 TOP 5 " + "\u2500".repeat(47), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#4b5563"
      });

    this.leaderboardText = this.add.text(120, 215, "Loading...", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#e5e7eb",
      lineSpacing: 6
    });

    this.add
      .text(120, 415, "\u2500\u2500 YOUR BEST " + "\u2500".repeat(43), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#4b5563"
      });

    this.playerBestText = this.add.text(120, 445, "", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#fcd34d",
      lineSpacing: 6
    });

    this.statusText = this.add
      .text(GAME_WIDTH / 2, 530, "", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#86efac"
      })
      .setOrigin(0.5);

    this.footerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 38, "", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#d1d5db",
        align: "center"
      })
      .setOrigin(0.5);

    this.refreshAll(result.trackId);
    this.updateFooter();

    this.input.keyboard?.on("keydown-S", () => this.handleSave());
    this.input.keyboard?.on("keydown-R", () => {
      this.cleanupDialog();
      this.scene.start("race");
    });
    this.input.keyboard?.on("keydown-M", () => {
      this.cleanupDialog();
      this.scene.start("menu");
    });
    this.input.keyboard?.on("keydown-DELETE", () => {
      clearPlayerName();
      this.updateFooter();
      this.statusText.setText("Name cleared.");
    });
  }

  shutdown(): void {
    this.cleanupDialog();
  }

  private updateFooter(): void {
    const name = getPlayerName();
    if (name) {
      this.footerText.setText(
        `Save as ${name}? [S]   Change name [Del]   Retry [R]   Menu [M]`
      );
    } else {
      this.footerText.setText("[S] Save score   [R] Retry   [M] Menu");
    }
  }

  private async refreshAll(trackId: string): Promise<void> {
    const playerName = getPlayerName();
    await Promise.all([
      this.refreshLeaderboard(trackId),
      playerName ? this.refreshPlayerBest(playerName, trackId) : Promise.resolve()
    ]);
  }

  private async refreshLeaderboard(trackId: string): Promise<void> {
    try {
      const rows = await getTopScores(trackId, 5);
      const lines = rows.length
        ? rows.map((e, i) => `${i + 1}. ${e.playerName.padEnd(16)} ${formatTime(e.timeMs)}`)
        : ["No records yet."];
      this.leaderboardText.setText(lines.join("\n"));
    } catch {
      this.leaderboardText.setText("Leaderboard unavailable.");
    }
  }

  private async refreshPlayerBest(playerName: string, trackId: string): Promise<void> {
    try {
      const best = await getPlayerBest(playerName, trackId);
      if (best) {
        this.playerBestText.setText(`\u2605  ${best.playerName.padEnd(16)} ${formatTime(best.timeMs)}`);
      } else {
        this.playerBestText.setText("No record yet.");
      }
    } catch {
      this.playerBestText.setText("");
    }
  }

  private handleSave(): void {
    const name = getPlayerName();
    if (name) {
      this.doSubmit(name);
    } else {
      this.openNameDialog();
    }
  }

  private async doSubmit(name: string): Promise<void> {
    const result = sessionState.result;
    if (!result) return;
    this.statusText.setText("Submitting...");
    try {
      await submitScore(name, result.trackId, result.finalTimeMs);
      this.statusText.setText("Score saved!");
      await this.refreshLeaderboard(result.trackId);
      await this.refreshPlayerBest(name, result.trackId);
    } catch {
      this.statusText.setText("Submit failed.");
    }
  }

  private openNameDialog(): void {
    if (this.nameDialog) return;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(11,18,34,0.85);
      display:flex;align-items:center;justify-content:center;
      z-index:9999;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background:#1e2d45;border:2px solid #93c5fd;padding:32px 40px;
      font-family:monospace;color:#f8fafc;text-align:center;
      min-width:360px;
    `;

    const label = document.createElement("div");
    label.textContent = "Enter your name (3–16 chars, A-Z 0-9 _ space)";
    label.style.cssText = "font-size:18px;margin-bottom:16px;color:#93c5fd;";

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = "RACER";
    input.style.cssText = `
      background:#0b1222;border:1px solid #4b5563;color:#f8fafc;
      font-family:monospace;font-size:22px;padding:8px 12px;
      width:100%;box-sizing:border-box;outline:none;text-align:center;
      margin-bottom:12px;
    `;

    const error = document.createElement("div");
    error.style.cssText = "font-size:14px;color:#f87171;min-height:18px;margin-bottom:8px;";

    const hint = document.createElement("div");
    hint.textContent = "Enter to confirm   Esc to cancel";
    hint.style.cssText = "font-size:14px;color:#6b7280;";

    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(error);
    box.appendChild(hint);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.nameDialog = overlay;

    setTimeout(() => input.focus(), 50);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const name = input.value.trim();
        if (!NAME_PATTERN.test(name)) {
          error.textContent = "Invalid name. Use 3-16 chars: letters, digits, _ or space.";
          return;
        }
        setPlayerName(name);
        this.cleanupDialog();
        this.updateFooter();
        this.doSubmit(name);
      } else if (e.key === "Escape") {
        this.cleanupDialog();
      }
      e.stopPropagation();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.cleanupDialog();
    });
  }

  private cleanupDialog(): void {
    if (this.nameDialog) {
      this.nameDialog.remove();
      this.nameDialog = null;
    }
  }
}
