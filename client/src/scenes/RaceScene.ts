import Phaser from "phaser";
import { CAMERA_BASE_ZOOM, CAMERA_LERP, CAMERA_LOOK_AHEAD_FACTOR, CAMERA_MIN_ZOOM, CAMERA_ZOOM_LERP, GAME_HEIGHT, GAME_WIDTH, TOTAL_LAPS } from "../core/constants";
import { carHandling } from "../core/physics/carHandling";
import { stepDriftModel } from "../core/physics/driftModel";
import { buildTrackGeometry } from "../core/track/geometry";
import { LapTracker } from "../core/track/lapTracker";
import { getDefaultTrackId, getTrackById, isOnTrack } from "../core/track/trackStore";
import type { RuntimeTrack } from "../core/track/types";
import type { CarState, InputState } from "../core/types";
import { sessionState } from "../state/session";
import { Hud } from "../ui/hud";

export class RaceScene extends Phaser.Scene {
  private static readonly CAR_SPRITE_HEADING_OFFSET = -Math.PI / 2;
  private static readonly ROAD_BORDER_PX = 10;
  private car!: Phaser.GameObjects.Sprite;
  private controls!: {
    throttle: Phaser.Input.Keyboard.Key[];
    brake: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    handbrake: Phaser.Input.Keyboard.Key[];
    restart: Phaser.Input.Keyboard.Key;
    escape: Phaser.Input.Keyboard.Key;
  };
  private carState!: CarState;
  private hud!: Hud;
  private lapTracker!: LapTracker;
  private activeTrack!: RuntimeTrack;
  private elapsedMs = 0;
  private timerStarted = false;
  private driftMarkCooldownMs = 0;
  private skidMarks: Phaser.GameObjects.Image[] = [];
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super("race");
  }

  create(): void {
    this.activeTrack =
      getTrackById(sessionState.selectedTrackId) ?? getTrackById(getDefaultTrackId())!;

    this.cameras.main.setBackgroundColor(this.activeTrack.asset.style.grassColor);
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setScroll(0, 0);
    this.elapsedMs = 0;
    this.timerStarted = false;
    this.driftMarkCooldownMs = 0;
    this.skidMarks.forEach((mark) => mark.destroy());
    this.skidMarks = [];
    this.drawTrack();

    this.carState = {
      position: { x: this.activeTrack.asset.spawn.x, y: this.activeTrack.asset.spawn.y },
      velocity: { x: 0, y: 0 },
      heading: this.activeTrack.asset.spawn.heading,
      angularVelocity: 0
    };

    this.car = this.add.sprite(this.carState.position.x, this.carState.position.y, "car");
    this.car.setOrigin(0.5);
    this.car.setDisplaySize(36, 50);
    this.car.setDepth(10);
    this.car.rotation = this.carState.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET;
    this.uiCamera.ignore(this.car);

    this.cameras.main.centerOn(this.carState.position.x, this.carState.position.y);
    this.cameras.main.setZoom(CAMERA_BASE_ZOOM);

    this.hud = new Hud(this);
    this.cameras.main.ignore(this.hud.getElements());

    this.lapTracker = new LapTracker(this.activeTrack, 0, TOTAL_LAPS);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input unavailable.");
    }
    this.controls = {
      throttle: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      ],
      brake: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      ],
      left: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      ],
      right: [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      ],
      handbrake: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)],
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    };
  }

  update(_time: number, deltaMs: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.controls.restart)) {
      this.scene.restart();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.controls.escape)) {
      if (sessionStorage.getItem("swag_is_test_drive") === "true") {
        sessionStorage.removeItem("swag_is_test_drive");
        const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
        window.location.href = `${base}editor`;
        return;
      }
    }

    const previousPosition = { ...this.carState.position };
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const pressed = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((key) => key.isDown);
    const input: InputState = {
      throttle: pressed(this.controls.throttle) ? 1 : 0,
      brake: pressed(this.controls.brake) ? 1 : 0,
      steer: (pressed(this.controls.right) ? 1 : 0) - (pressed(this.controls.left) ? 1 : 0),
      handbrake: pressed(this.controls.handbrake)
    };

    const onTrack = isOnTrack(this.carState.position.x, this.carState.position.y, this.activeTrack);
    const driftStep = stepDriftModel(this.carState, input, dt, carHandling, !onTrack);
    this.carState = driftStep.state;

    if (!this.timerStarted && driftStep.speed > 2) {
      this.timerStarted = true;
    }
    if (this.timerStarted) {
      this.elapsedMs += deltaMs;
    }

    this.car.setPosition(this.carState.position.x, this.carState.position.y);
    this.car.rotation = this.carState.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET;

    const lookAheadX = this.carState.position.x + this.carState.velocity.x * CAMERA_LOOK_AHEAD_FACTOR;
    const lookAheadY = this.carState.position.y + this.carState.velocity.y * CAMERA_LOOK_AHEAD_FACTOR;

    const targetScrollX = lookAheadX - this.cameras.main.width / 2;
    const targetScrollY = lookAheadY - this.cameras.main.height / 2;

    this.cameras.main.scrollX += (targetScrollX - this.cameras.main.scrollX) * CAMERA_LERP;
    this.cameras.main.scrollY += (targetScrollY - this.cameras.main.scrollY) * CAMERA_LERP;

    const speedFactor = Math.min(1, driftStep.speed / carHandling.maxSpeed);
    const targetZoom = Phaser.Math.Linear(CAMERA_BASE_ZOOM, CAMERA_MIN_ZOOM, speedFactor);
    this.cameras.main.zoom += (targetZoom - this.cameras.main.zoom) * CAMERA_ZOOM_LERP;

    this.updateDriftFx(driftStep.isDrifting, deltaMs);

    const lapUpdate = this.lapTracker.update(previousPosition, this.carState.position, this.elapsedMs);

    const elapsed = Math.round(this.elapsedMs);
    this.hud.update(
      driftStep.speed,
      lapUpdate.state.lapNumber,
      TOTAL_LAPS,
      elapsed,
      driftStep.isDrifting
    );

    if (lapUpdate.raceCompleted && lapUpdate.state.bestLapMs !== null) {
      sessionState.result = {
        finalTimeMs: elapsed,
        bestLapMs: Math.round(lapUpdate.state.bestLapMs),
        trackId: this.activeTrack.asset.id
      };
      this.scene.start("result");
    }
  }

  private colorToNumber(hexColor: string): number {
    return Number.parseInt(hexColor.replace("#", ""), 16);
  }

  private drawTrack(): void {
    const gfx = this.add.graphics();
    const grassColor = this.colorToNumber(this.activeTrack.asset.style.grassColor);
    const asphaltColor = this.colorToNumber(this.activeTrack.asset.style.asphaltColor);
    const borderColor = this.colorToNumber(this.activeTrack.asset.style.borderColor);

    const bounds = this.activeTrack.geometry.bounds;
    const margin = 2000;

    gfx.fillStyle(grassColor, 1);
    gfx.fillRect(bounds.minX - margin, bounds.minY - margin, (bounds.maxX - bounds.minX) + margin * 2, (bounds.maxY - bounds.minY) + margin * 2);

    gfx.fillStyle(0x70cda9, 0.28);
    const startX = Math.floor((bounds.minX - margin) / 64) * 64;
    for (let x = startX; x < bounds.maxX + margin; x += 64) {
      gfx.fillRect(x, bounds.minY - margin, 32, (bounds.maxY - bounds.minY) + margin * 2);
    }

    const borderGeometry = buildTrackGeometry({
      ...this.activeTrack.asset,
      roadWidth: this.activeTrack.asset.roadWidth + RaceScene.ROAD_BORDER_PX * 2
    });
    gfx.fillStyle(borderColor, 1);
    borderGeometry.quads.forEach((quad) => {
      gfx.fillPoints(quad, true);
    });

    gfx.fillStyle(asphaltColor, 1);
    this.activeTrack.geometry.quads.forEach((quad) => {
      gfx.fillPoints(quad, true);
    });

    gfx.lineStyle(3, 0xf8fafc, 0.35);
    gfx.strokePoints(this.activeTrack.geometry.sampledCenterline, true);

    this.activeTrack.asset.checkpoints.forEach((checkpoint, index) => {
      if (index === 0) {
        gfx.lineStyle(6, 0xffffff, 1);
      } else {
        gfx.lineStyle(4, 0xffcc00, 0.55);
      }
      gfx.lineBetween(checkpoint.a.x, checkpoint.a.y, checkpoint.b.x, checkpoint.b.y);
    });

    if (this.uiCamera) {
      this.uiCamera.ignore(gfx);
    }
  }

  private updateDriftFx(isDrifting: boolean, deltaMs: number): void {
    this.driftMarkCooldownMs -= deltaMs;
    if (!isDrifting || this.driftMarkCooldownMs > 0) {
      return;
    }

    this.driftMarkCooldownMs = 45;
    const forwardX = Math.cos(this.carState.heading);
    const forwardY = Math.sin(this.carState.heading);
    const leftX = this.carState.position.x - forwardX * 10 - forwardY * 6;
    const leftY = this.carState.position.y - forwardY * 10 + forwardX * 6;
    const rightX = this.carState.position.x - forwardX * 10 + forwardY * 6;
    const rightY = this.carState.position.y - forwardY * 10 - forwardX * 6;

    [leftX, rightX].forEach((x, i) => {
      const y = i === 0 ? leftY : rightY;
      const mark = this.add
        .image(x, y, "tire")
        .setRotation(this.carState.heading)
        .setScale(2)
        .setAlpha(0.45)
        .setDepth(1)
        .setTint(0x1f1f1f);
      if (this.uiCamera) {
        this.uiCamera.ignore(mark);
      }
      this.skidMarks.push(mark);
    });

    if (this.skidMarks.length > 220) {
      const oldest = this.skidMarks.shift();
      oldest?.destroy();
    }
  }
}
