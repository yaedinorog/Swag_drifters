import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
import { getTracks } from "../core/track/trackStore";
import type { RuntimeTrack } from "../core/track/types";
import { sessionState } from "../state/session";

export class LevelSelectScene extends Phaser.Scene {
  private selectedTrackIndex = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private tracks: RuntimeTrack[] = [];

  constructor() {
    super("level_select");
  }

  create(): void {
    this.tracks = getTracks();
    this.cameras.main.setBackgroundColor("#0a0f1a");

    this.add
      .text(GAME_WIDTH / 2, 80, "LEVEL SELECT", {
        fontFamily: "monospace",
        fontSize: "54px",
        color: "#d0f0ff"
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        140,
        "LEFT/RIGHT: choose level    ENTER/SPACE: start    ESC: menu",
        {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    const savedTrackIndex = this.tracks.findIndex((track) => track.asset.id === sessionState.selectedTrackId);
    this.selectedTrackIndex = savedTrackIndex >= 0 ? savedTrackIndex : 0;

    const totalWidth = this.tracks.length * 460 + Math.max(0, this.tracks.length - 1) * 50;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + 230;
    this.cards = this.tracks.map((track, index) => this.createTrackCard(startX + index * 510, 390, track));
    this.refreshCards();

    this.input.keyboard?.on("keydown-LEFT", this.selectPrevious, this);
    this.input.keyboard?.on("keydown-RIGHT", this.selectNext, this);
    this.input.keyboard?.on("keydown-ENTER", this.startRace, this);
    this.input.keyboard?.on("keydown-SPACE", this.startRace, this);
    this.input.keyboard?.on("keydown-ESC", this.backToMenu, this);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-LEFT", this.selectPrevious, this);
      this.input.keyboard?.off("keydown-RIGHT", this.selectNext, this);
      this.input.keyboard?.off("keydown-ENTER", this.startRace, this);
      this.input.keyboard?.off("keydown-SPACE", this.startRace, this);
      this.input.keyboard?.off("keydown-ESC", this.backToMenu, this);
    });
  }

  private createTrackCard(x: number, y: number, track: RuntimeTrack): Phaser.GameObjects.Container {
    const cardWidth = 460;
    const cardHeight = 420;
    const card = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x111827)
      .setStrokeStyle(3, 0x374151, 1)
      .setOrigin(0.5);
    const title = this.add
      .text(0, -165, track.asset.name, {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 165, track.asset.id, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#9ca3af"
      })
      .setOrigin(0.5);

    const preview = this.add.graphics();
    preview.setPosition(0, 5);
    preview.lineStyle(7, 0xd1d5db, 1);

    const bounds = track.geometry.bounds;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const maxSide = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const scale = 250 / Math.max(maxSide, 1);

    const previewPoints = track.geometry.sampledCenterline.map((point) =>
      new Phaser.Geom.Point((point.x - centerX) * scale, (point.y - centerY) * scale)
    );
    preview.strokePoints(previewPoints, true);

    card.add([bg, title, preview, subtitle]);
    card.setSize(cardWidth, cardHeight);
    card.setInteractive(
      new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
      Phaser.Geom.Rectangle.Contains
    );
    card.on("pointerdown", () => {
      this.selectedTrackIndex = this.tracks.findIndex((item) => item.asset.id === track.asset.id);
      this.refreshCards();
    });
    card.on("pointerup", () => this.startRace());
    return card;
  }

  private refreshCards(): void {
    this.cards.forEach((card, index) => {
      const bg = card.getAt(0) as Phaser.GameObjects.Rectangle;
      const title = card.getAt(1) as Phaser.GameObjects.Text;
      const subtitle = card.getAt(3) as Phaser.GameObjects.Text;
      const selected = index === this.selectedTrackIndex;
      bg.setStrokeStyle(selected ? 5 : 3, selected ? 0xf59e0b : 0x374151, 1);
      bg.setFillStyle(selected ? 0x162034 : 0x111827, 1);
      title.setColor(selected ? "#facc15" : "#e5e7eb");
      subtitle.setColor(selected ? "#fbbf24" : "#9ca3af");
      card.setScale(selected ? 1 : 0.93);
      card.setDepth(selected ? 10 : 1);
    });
  }

  private selectPrevious(): void {
    this.selectedTrackIndex = (this.selectedTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.refreshCards();
  }

  private selectNext(): void {
    this.selectedTrackIndex = (this.selectedTrackIndex + 1) % this.tracks.length;
    this.refreshCards();
  }

  private startRace(): void {
    sessionState.selectedTrackId = this.tracks[this.selectedTrackIndex].asset.id;
    this.scene.start("race");
  }

  private backToMenu(): void {
    this.scene.start("menu");
  }
}
