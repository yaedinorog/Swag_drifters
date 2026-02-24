import Phaser from "phaser";
import { formatTime } from "../services/api/leaderboardApi";

export class Hud {
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly lapText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly driftText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.speedText = scene.add.text(20, 20, "Speed: 0 km/h", this.getStyle());
    this.lapText = scene.add.text(20, 50, "Lap: 1/3", this.getStyle());
    this.timerText = scene.add.text(20, 80, "Time: 00:00.000", this.getStyle());
    this.driftText = scene.add.text(20, 110, "DRIFT", {
      ...this.getStyle(),
      color: "#ffcd4b"
    });
    this.driftText.setVisible(false);

    [this.speedText, this.lapText, this.timerText, this.driftText].forEach((text) => {
      text.setScrollFactor(0);
      text.setDepth(100);
    });
  }

  update(speed: number, lap: number, totalLaps: number, elapsedMs: number, drifting: boolean): void {
    const kmh = Math.round(speed * 0.18);
    this.speedText.setText(`Speed: ${kmh} km/h`);
    this.lapText.setText(`Lap: ${Math.min(lap, totalLaps)}/${totalLaps}`);
    this.timerText.setText(`Time: ${formatTime(elapsedMs)}`);
    this.driftText.setVisible(drifting);
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
