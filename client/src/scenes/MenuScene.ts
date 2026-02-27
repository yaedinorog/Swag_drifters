import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";

export class MenuScene extends Phaser.Scene {
  private levelSelectButton?: Phaser.GameObjects.Text;
  private editorButton?: Phaser.GameObjects.Text;

  constructor() {
    super("menu");
  }

  create(): void {
    this.input.enabled = true;
    this.cameras.main.setBackgroundColor("#0c1018");
    this.add
      .text(GAME_WIDTH / 2, 190, "DRIFT LOOP MVP", {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#d0f0ff"
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 300, "W/S or Up/Down: Throttle & Brake\nA/D or Left/Right: Steer\nSpace: Handbrake", {
        fontFamily: "monospace",
        fontSize: "24px",
        align: "center",
        color: "#f5f5f5"
      })
      .setOrigin(0.5);

    this.levelSelectButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, "[ LEVEL SELECT ]", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ffd166",
        backgroundColor: "#172034",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.levelSelectButton.on("pointerdown", this.handleLevelSelect, this);

    this.editorButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 210, "[ TRACK EDITOR ]", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#93c5fd",
        backgroundColor: "#172034",
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.editorButton.on("pointerdown", this.handleOpenEditor, this);

    this.input.keyboard?.on("keydown-SPACE", this.handleLevelSelect, this);
    this.input.keyboard?.on("keydown-ENTER", this.handleLevelSelect, this);

    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-SPACE", this.handleLevelSelect, this);
      this.input.keyboard?.off("keydown-ENTER", this.handleLevelSelect, this);
    });
  }

  private handleLevelSelect(): void {
    this.scene.start("level_select");
  }

  private handleOpenEditor(): void {
    const base = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    window.location.href = `${base}editor`;
  }
}
