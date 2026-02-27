import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";

interface PauseSceneData {
  from?: string;
}

export class PauseScene extends Phaser.Scene {
  private resumeText?: Phaser.GameObjects.Text;
  private levelSelectText?: Phaser.GameObjects.Text;
  private menuText?: Phaser.GameObjects.Text;

  constructor() {
    super("pause");
  }

  create(data: PauseSceneData): void {
    const fromScene = data.from ?? "race";
    this.cameras.main.setBackgroundColor("rgba(0, 0, 0, 0.45)");

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 140, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "54px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.resumeText = this.add
      .text(GAME_WIDTH / 2, 260, "[ RESUME ]", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#a7f3d0",
        backgroundColor: "#0f172a",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.levelSelectText = this.add
      .text(GAME_WIDTH / 2, 340, "[ LEVEL SELECT ]", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#fcd34d",
        backgroundColor: "#0f172a",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.menuText = this.add
      .text(GAME_WIDTH / 2, 420, "[ MAIN MENU ]", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#93c5fd",
        backgroundColor: "#0f172a",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.resumeText.on("pointerdown", () => this.resume(fromScene));
    this.levelSelectText.on("pointerdown", () => this.gotoLevelSelect(fromScene));
    this.menuText.on("pointerdown", () => this.gotoMenu(fromScene));

    this.input.keyboard?.on("keydown-ESC", () => this.resume(fromScene));
    this.input.keyboard?.on("keydown-P", () => this.resume(fromScene));
    this.input.keyboard?.on("keydown-R", () => this.resume(fromScene));
    this.input.keyboard?.on("keydown-L", () => this.gotoLevelSelect(fromScene));
    this.input.keyboard?.on("keydown-M", () => this.gotoMenu(fromScene));

    this.add
      .text(GAME_WIDTH / 2, 610, "[P/ESC] Resume   [L] Level Select   [M] Menu", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#d1d5db"
      })
      .setOrigin(0.5);

    this.events.once("shutdown", () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  private resume(fromScene: string): void {
    this.scene.stop();
    if (this.scene.isPaused(fromScene)) {
      this.scene.resume(fromScene);
    }
  }

  private gotoLevelSelect(fromScene: string): void {
    this.scene.stop(fromScene);
    this.scene.stop();
    this.scene.start("level_select");
  }

  private gotoMenu(fromScene: string): void {
    this.scene.stop(fromScene);
    this.scene.stop();
    this.scene.start("menu");
  }
}
