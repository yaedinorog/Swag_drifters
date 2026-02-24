import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TOTAL_LAPS, TRACK_ID } from "../core/constants";
import { carHandling } from "../core/physics/carHandling";
import { stepDriftModel } from "../core/physics/driftModel";
import { LapTracker } from "../core/track/lapTracker";
import { isOnTrack, track01 } from "../core/track/trackConfig";
import type { CarState, InputState } from "../core/types";
import { sessionState } from "../state/session";
import { Hud } from "../ui/hud";

export class RaceScene extends Phaser.Scene {
  private static readonly CAR_SPRITE_HEADING_OFFSET = -Math.PI / 2;
  private car!: Phaser.GameObjects.Sprite;
  private controls!: {
    throttle: Phaser.Input.Keyboard.Key[];
    brake: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    handbrake: Phaser.Input.Keyboard.Key[];
  };
  private carState!: CarState;
  private hud!: Hud;
  private lapTracker!: LapTracker;
  private elapsedMs = 0;
  private driftMarkCooldownMs = 0;
  private skidMarks: Phaser.GameObjects.Image[] = [];

  constructor() {
    super("race");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#1f2937");
    this.elapsedMs = 0;
    this.driftMarkCooldownMs = 0;
    this.skidMarks.forEach((mark) => mark.destroy());
    this.skidMarks = [];
    this.drawTrack();

    this.carState = {
      position: { x: track01.spawn.x, y: track01.spawn.y },
      velocity: { x: 0, y: 0 },
      heading: track01.spawn.heading,
      angularVelocity: 0
    };

    this.car = this.add.sprite(this.carState.position.x, this.carState.position.y, "car");
    this.car.setOrigin(0.5);
    this.car.setDisplaySize(36, 50);
    this.car.rotation = this.carState.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET;

    this.hud = new Hud(this);
    this.lapTracker = new LapTracker(track01, 0, TOTAL_LAPS);

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
      handbrake: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)]
    };
  }

  update(_time: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const pressed = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((key) => key.isDown);
    const input: InputState = {
      throttle: pressed(this.controls.throttle) ? 1 : 0,
      brake: pressed(this.controls.brake) ? 1 : 0,
      steer: (pressed(this.controls.right) ? 1 : 0) - (pressed(this.controls.left) ? 1 : 0),
      handbrake: pressed(this.controls.handbrake)
    };

    const onTrack = isOnTrack(this.carState.position.x, this.carState.position.y, track01);
    const driftStep = stepDriftModel(this.carState, input, dt, carHandling, !onTrack);
    this.carState = driftStep.state;

    this.car.setPosition(this.carState.position.x, this.carState.position.y);
    this.car.rotation = this.carState.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET;

    this.updateDriftFx(driftStep.isDrifting, deltaMs);

    const lapUpdate = this.lapTracker.update(
      this.carState.position.x,
      this.carState.position.y,
      this.elapsedMs
    );

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
        trackId: TRACK_ID
      };
      this.scene.start("result");
    }
  }

  private drawTrack(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x7adcb6, 1);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    gfx.fillStyle(0x70cda9, 0.35);
    for (let x = 0; x < GAME_WIDTH; x += 64) {
      gfx.fillRect(x, 0, 32, GAME_HEIGHT);
    }

    gfx.fillStyle(0x2f3138, 1);
    gfx.fillRect(track01.outer.x, track01.outer.y, track01.outer.width, track01.outer.height);
    gfx.fillStyle(0x7adcb6, 1);
    gfx.fillRect(track01.inner.x, track01.inner.y, track01.inner.width, track01.inner.height);

    gfx.lineStyle(6, 0xeeeeee, 1);
    gfx.strokeRect(track01.outer.x, track01.outer.y, track01.outer.width, track01.outer.height);
    gfx.strokeRect(track01.inner.x, track01.inner.y, track01.inner.width, track01.inner.height);

    const midRect = {
      x: (track01.outer.x + track01.inner.x) / 2,
      y: (track01.outer.y + track01.inner.y) / 2,
      width: (track01.outer.width + track01.inner.width) / 2,
      height: (track01.outer.height + track01.inner.height) / 2
    };
    gfx.lineStyle(3, 0xf8fafc, 0.45);
    gfx.strokeRect(midRect.x, midRect.y, midRect.width, midRect.height);

    gfx.lineStyle(10, 0xd64545, 1);
    gfx.strokeRect(track01.outer.x + 2, track01.outer.y + 2, track01.outer.width - 4, track01.outer.height - 4);
    gfx.strokeRect(track01.inner.x - 2, track01.inner.y - 2, track01.inner.width + 4, track01.inner.height + 4);

    const start = track01.checkpoints[0];
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(start.x, start.y, start.width, start.height);

    for (let index = 1; index < track01.checkpoints.length; index += 1) {
      const cp = track01.checkpoints[index];
      gfx.fillStyle(0xffcc00, 0.3);
      gfx.fillRect(cp.x, cp.y, cp.width, cp.height);
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
        .setDepth(5)
        .setTint(0x1f1f1f);
      this.skidMarks.push(mark);
    });

    if (this.skidMarks.length > 220) {
      const oldest = this.skidMarks.shift();
      oldest?.destroy();
    }
  }
}
