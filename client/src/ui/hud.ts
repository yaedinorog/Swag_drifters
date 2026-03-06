import Phaser from "phaser";
import { formatTime } from "../services/api/leaderboardApi";

const TURBO_BAR_W = 21;
const TURBO_BAR_H = 500;
const TURBO_X = 27;      // center-x of vertical bar
const TURBO_Y_TOP = 170; // bar top: centered vertically on 720px screen

export class Hud {
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly lapText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly driftText: Phaser.GameObjects.Text;
  private readonly turboLabel: Phaser.GameObjects.Text;
  private readonly turboBarBg: Phaser.GameObjects.Rectangle;
  private readonly turboBarFill: Phaser.GameObjects.Rectangle;
  private readonly turboActiveText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.speedText = scene.add.text(20, 20, "Speed: 0 km/h", this.getStyle());
    this.lapText = scene.add.text(20, 50, "Lap: 1/3", this.getStyle());
    this.timerText = scene.add.text(20, 80, "Time: 00:00.000", this.getStyle());
    this.driftText = scene.add.text(20, 110, "DRIFT", {
      ...this.getStyle(),
      color: "#ffcd4b"
    });
    this.driftText.setVisible(false);

    this.turboLabel = scene.add.text(TURBO_X, TURBO_Y_TOP - 8, "TURBO", {
      ...this.getStyle(),
      fontSize: "13px",
      color: "#88aaff"
    }).setOrigin(0.5, 1);

    this.turboBarBg = scene.add.rectangle(
      TURBO_X,
      TURBO_Y_TOP + TURBO_BAR_H / 2,
      TURBO_BAR_W,
      TURBO_BAR_H,
      0x222244
    );

    this.turboBarFill = scene.add.rectangle(
      TURBO_X,
      TURBO_Y_TOP + TURBO_BAR_H,
      TURBO_BAR_W,
      0,
      0x4488ff
    );
    this.turboBarFill.setOrigin(0.5, 1);

    this.turboActiveText = scene.add.text(TURBO_X, TURBO_Y_TOP + TURBO_BAR_H + 8, "BOOST!", {
      ...this.getStyle(),
      fontSize: "13px",
      color: "#00ffff"
    }).setOrigin(0.5, 0);
    this.turboActiveText.setVisible(false);

    [
      this.speedText,
      this.lapText,
      this.timerText,
      this.driftText,
      this.turboLabel,
      this.turboBarBg,
      this.turboBarFill,
      this.turboActiveText
    ].forEach((obj) => {
      obj.setScrollFactor(0);
      obj.setDepth(100);
    });
  }

  getElements(): Phaser.GameObjects.GameObject[] {
    return [
      this.speedText,
      this.lapText,
      this.timerText,
      this.driftText,
      this.turboLabel,
      this.turboBarBg,
      this.turboBarFill,
      this.turboActiveText
    ];
  }

  update(
    speed: number,
    lap: number,
    totalLaps: number,
    elapsedMs: number,
    drifting: boolean,
    turboCharge: number,
    turboMax: number,
    turboActive: boolean
  ): void {
    const kmh = Math.round(speed * 0.18);
    this.speedText.setText(`Speed: ${kmh} km/h`);
    this.lapText.setText(`Lap: ${Math.min(lap, totalLaps)}/${totalLaps}`);
    this.timerText.setText(`Time: ${formatTime(elapsedMs)}`);
    this.driftText.setVisible(drifting);

    const ratio = turboMax > 0 ? Math.min(turboCharge / turboMax, 1) : 0;
    this.turboBarFill.setSize(TURBO_BAR_W, TURBO_BAR_H * ratio);
    this.turboBarFill.setFillStyle(turboActive ? 0x00ffff : 0x4488ff);
    this.turboLabel.setColor(turboActive ? "#00ffff" : "#88aaff");
    this.turboActiveText.setVisible(turboActive);
  }

  private getStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#e8eef2",
      stroke: "#000000",
      strokeThickness: 4
    };
  }
}
