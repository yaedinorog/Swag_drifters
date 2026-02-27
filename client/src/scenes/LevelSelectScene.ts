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
        "ARROWS: choose level    DOUBLE CLICK or ENTER/SPACE: start    ESC: menu",
        {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    this.selectedTrackIndex = 0;
    if (sessionState.selectedTrackId) {
      const savedTrackIndex = this.tracks.findIndex((track) => track.asset.id === sessionState.selectedTrackId);
      if (savedTrackIndex >= 0) {
        this.selectedTrackIndex = savedTrackIndex;
      }
    }

    const startX = GAME_WIDTH / 2 - (260 * 1.5);
    const startY = 250;

    for (let i = 0; i < 16; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = startX + col * 260;
      const y = startY + row * 130;

      const track = i < this.tracks.length ? this.tracks[i] : undefined;
      this.cards.push(this.createTrackCard(x, y, track, i));
    }

    this.refreshCards();

    this.input.keyboard?.on("keydown-LEFT", this.selectLeft, this);
    this.input.keyboard?.on("keydown-RIGHT", this.selectRight, this);
    this.input.keyboard?.on("keydown-UP", this.selectUp, this);
    this.input.keyboard?.on("keydown-DOWN", this.selectDown, this);
    this.input.keyboard?.on("keydown-ENTER", this.startRace, this);
    this.input.keyboard?.on("keydown-SPACE", this.startRace, this);
    this.input.keyboard?.on("keydown-ESC", this.backToMenu, this);

    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-LEFT", this.selectLeft, this);
      this.input.keyboard?.off("keydown-RIGHT", this.selectRight, this);
      this.input.keyboard?.off("keydown-UP", this.selectUp, this);
      this.input.keyboard?.off("keydown-DOWN", this.selectDown, this);
      this.input.keyboard?.off("keydown-ENTER", this.startRace, this);
      this.input.keyboard?.off("keydown-SPACE", this.startRace, this);
      this.input.keyboard?.off("keydown-ESC", this.backToMenu, this);
    });
  }

  private createTrackCard(x: number, y: number, track: RuntimeTrack | undefined, index: number): Phaser.GameObjects.Container {
    const cardWidth = 240;
    const cardHeight = 110;
    const card = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x111827)
      .setStrokeStyle(2, 0x374151, 1)
      .setOrigin(0.5);

    card.add(bg);

    if (track) {
      const title = this.add
        .text(0, -35, track.asset.name, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#e5e7eb"
        })
        .setOrigin(0.5);

      const preview = this.add.graphics();
      preview.setPosition(0, 10);
      preview.lineStyle(3, 0xd1d5db, 1);

      const bounds = track.geometry.bounds;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const maxSide = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
      const scale = 50 / Math.max(maxSide, 1);

      const previewPoints = track.geometry.sampledCenterline.map((point) =>
        new Phaser.Geom.Point((point.x - centerX) * scale, (point.y - centerY) * scale)
      );
      preview.strokePoints(previewPoints, true);

      card.add([title, preview]);
    } else {
      const lockedText = this.add
        .text(0, 0, "?", {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#4b5563"
        })
        .setOrigin(0.5);
      card.add(lockedText);
    }

    card.setSize(cardWidth, cardHeight);
    card.setInteractive(
      new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
      Phaser.Geom.Rectangle.Contains
    );
    card.on("pointerdown", () => {
      if (!track) return;
      if (this.selectedTrackIndex === index) {
        this.startRace();
      } else {
        this.selectedTrackIndex = index;
        this.refreshCards();
      }
    });

    return card;
  }

  private refreshCards(): void {
    this.cards.forEach((card, index) => {
      const bg = card.getAt(0) as Phaser.GameObjects.Rectangle;
      const selected = index === this.selectedTrackIndex && index < this.tracks.length;
      bg.setStrokeStyle(selected ? 4 : 2, selected ? 0xf59e0b : 0x374151, 1);
      bg.setFillStyle(selected ? 0x162034 : 0x111827, 1);

      if (index < this.tracks.length) {
        const title = card.getAt(1) as Phaser.GameObjects.Text;
        title.setColor(selected ? "#facc15" : "#e5e7eb");
      }

      card.setScale(selected ? 1.05 : 1);
      card.setDepth(selected ? 10 : 1);
    });
  }

  private selectLeft(): void {
    if (this.tracks.length === 0) return;
    this.selectedTrackIndex = (this.selectedTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.refreshCards();
  }

  private selectRight(): void {
    if (this.tracks.length === 0) return;
    this.selectedTrackIndex = (this.selectedTrackIndex + 1) % this.tracks.length;
    this.refreshCards();
  }

  private selectUp(): void {
    if (this.tracks.length === 0) return;
    if (this.selectedTrackIndex - 4 >= 0) {
      this.selectedTrackIndex -= 4;
      this.refreshCards();
    }
  }

  private selectDown(): void {
    if (this.tracks.length === 0) return;
    if (this.selectedTrackIndex + 4 < this.tracks.length) {
      this.selectedTrackIndex += 4;
      this.refreshCards();
    }
  }

  private startRace(): void {
    if (this.selectedTrackIndex >= 0 && this.selectedTrackIndex < this.tracks.length) {
      sessionState.selectedTrackId = this.tracks[this.selectedTrackIndex].asset.id;
      this.scene.start("race");
    }
  }

  private backToMenu(): void {
    this.scene.start("menu");
  }
}
