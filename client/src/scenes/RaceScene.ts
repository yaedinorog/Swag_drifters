import Phaser from "phaser";
import { CAMERA_BASE_ZOOM, CAMERA_LERP, CAMERA_LOOK_AHEAD_FACTOR, CAMERA_MIN_ZOOM, CAMERA_ZOOM_LERP, GAME_HEIGHT, GAME_WIDTH, TOTAL_LAPS } from "../core/constants";
import { DEFAULT_CAR, getEffectiveHandling } from "../core/physics/carHandling";
import { stepDriftModel } from "../core/physics/driftModel";
import { buildTrackGeometry } from "../core/track/geometry";
import { LapTracker } from "../core/track/lapTracker";
import { getDefaultTrackId, getTrackById, isOnTrack } from "../core/track/trackStore";
import type { RuntimeTrack } from "../core/track/types";
import type { CarState, InputState } from "../core/types";
import { getSocket } from "../services/socket";
import { sessionState } from "../state/session";
import { Hud } from "../ui/hud";

interface Ghost {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  targetRot: number;
}

interface RaceSceneData {
  onlineMode?: boolean;
}

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
    pause: Phaser.Input.Keyboard.Key;
  };
  private carState!: CarState;
  private hud!: Hud;
  private lapTracker!: LapTracker;
  private activeTrack!: RuntimeTrack;
  private trackLapDistance = 0;
  private elapsedMs = 0;
  private timerStarted = false;
  private driftMarkCooldownMs = 0;
  private skidMarks: { sprite: Phaser.GameObjects.Image; createdAtMs: number }[] = [];
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private turboCharge = 0;
  private turboActive = false;
  private turboExhausted = false;
  private isDrifting = false;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private turboFlame!: Phaser.GameObjects.Particles.ParticleEmitter;
  private turboArcGfx!: Phaser.GameObjects.Graphics;

  // Online mode
  private onlineMode = false;
  private ghosts = new Map<string, Ghost>();
  private positionBroadcastMs = 0;
  private controlsLocked = false;
  private raceFinishedSent = false;
  private dnfText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;

  constructor() {
    super("race");
  }

  init(data: RaceSceneData): void {
    this.onlineMode = data.onlineMode === true;
  }

  create(): void {
    const online = sessionState.online;
    let trackId: string;

    if (this.onlineMode && online) {
      trackId = online.trackList[online.currentTrackIndex] ?? getDefaultTrackId();
    } else {
      trackId = sessionState.selectedTrackId;
    }

    this.activeTrack =
      getTrackById(trackId) ?? getTrackById(getDefaultTrackId())!;

    this.cameras.main.setBackgroundColor(this.activeTrack.asset.style.grassColor);
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setScroll(0, 0);
    this.elapsedMs = 0;
    this.timerStarted = false;
    this.driftMarkCooldownMs = 0;
    this.turboCharge = 0;
    this.turboActive = false;
    this.turboExhausted = false;
    this.isDrifting = false;
    this.controlsLocked = false;
    this.raceFinishedSent = false;
    this.positionBroadcastMs = 0;
    this.ghosts.clear();
    this.skidMarks.forEach((mark) => mark.sprite.destroy());
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

    // Flame particle texture
    const fGfx = this.make.graphics();
    fGfx.fillStyle(0xffffff, 0.12);
    fGfx.fillEllipse(4, 10, 8, 20);
    fGfx.fillStyle(0xffffff, 0.45);
    fGfx.fillEllipse(4, 10, 5, 12);
    fGfx.fillStyle(0xffffff, 1.0);
    fGfx.fillEllipse(4, 10, 2.5, 6);
    fGfx.generateTexture("flame_particle", 8, 20);
    fGfx.destroy();

    this.turboFlame = this.add.particles(
      this.carState.position.x,
      this.carState.position.y,
      "flame_particle",
      {
        lifespan: { min: 80, max: 210 },
        velocityX: { onEmit: () => Math.cos(this.carState.heading + Math.PI) * (110 + Math.random() * 140) + (Math.random() - 0.5) * 30 },
        velocityY: { onEmit: () => Math.sin(this.carState.heading + Math.PI) * (110 + Math.random() * 140) + (Math.random() - 0.5) * 30 },
        rotate: { onEmit: () => Phaser.Math.RadToDeg(this.carState.heading + Math.PI / 2) },
        scale: { start: 1.0, end: 0 },
        alpha: { start: 1.0, end: 0 },
        tint: [0xffffff, 0xccf4ff, 0x44ccff, 0x0099ff, 0x0044ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 10,
        quantity: 5,
        emitting: false
      } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig
    );
    this.turboFlame.setDepth(9);
    this.uiCamera.ignore(this.turboFlame);

    this.cameras.main.centerOn(this.carState.position.x, this.carState.position.y);
    this.cameras.main.setZoom(CAMERA_BASE_ZOOM);

    this.hud = new Hud(this);
    this.cameras.main.ignore(this.hud.getElements());

    this.turboArcGfx = this.add.graphics();
    this.turboArcGfx.setDepth(11);
    this.uiCamera.ignore(this.turboArcGfx);

    const totalLaps = this.onlineMode && online ? online.laps : TOTAL_LAPS;
    this.lapTracker = new LapTracker(this.activeTrack, 0, totalLaps);
    this.trackLapDistance = this.computeLapDistance(this.activeTrack);

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
      escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      pause: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    };
    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    if (this.onlineMode) {
      // Spawn ghosts for players already in the room (excluding self)
      const myId = sessionState.online?.mySocketId;
      for (const p of sessionState.online?.players ?? []) {
        if (p.socketId !== myId) {
          this.spawnGhost(p.socketId, p.nickname);
        }
      }
      this.setupOnlineListeners();
      // Tell server we're ready (countdown will come back)
      getSocket().emit("ready_to_race");
      // Lock controls until countdown fires race_go
      this.controlsLocked = true;
    }
  }

  shutdown(): void {
    if (this.onlineMode) {
      this.removeOnlineListeners();
    }
    this.ghosts.forEach((g) => {
      g.sprite.destroy();
      g.label.destroy();
    });
    this.ghosts.clear();
  }

  private setupOnlineListeners(): void {
    const socket = getSocket();

    socket.on("countdown_start", () => {
      this.controlsLocked = true;
      this.showCountdown();
    });

    socket.on("race_go", () => {
      this.controlsLocked = false;
      if (this.countdownText) {
        this.countdownText.setText("GO!");
        this.time.delayedCall(700, () => {
          this.countdownText?.destroy();
          this.countdownText = undefined;
        });
      }
    });

    socket.on("player_moved", ({ socketId, x, y, rotation }) => {
      const ghost = this.ghosts.get(socketId);
      if (ghost) {
        ghost.targetX = x;
        ghost.targetY = y;
        ghost.targetRot = rotation;
      }
    });

    socket.on("player_joined", ({ socketId, nickname }) => {
      this.spawnGhost(socketId, nickname);
    });

    socket.on("player_left", ({ socketId }) => {
      const g = this.ghosts.get(socketId);
      if (g) {
        g.sprite.destroy();
        g.label.destroy();
        this.ghosts.delete(socketId);
      }
    });

    socket.on("game_paused", () => {
      this.openPause();
    });

    socket.on("game_resumed", () => {
      if (this.scene.isActive("pause")) {
        this.scene.stop("pause");
      }
      if (this.scene.isPaused("race")) {
        this.scene.resume("race");
      }
    });

    socket.on("dnf_warning", ({ secondsLeft }) => {
      this.showDnfWarning(secondsLeft);
    });

    socket.on("track_results", (results) => {
      if (sessionState.online) {
        sessionState.online.lastTrackResults = results;
      }
      this.scene.start("online_result");
    });

    socket.on("player_finished", ({ socketId }) => {
      // Visual feedback: grey out ghost when finished
      const ghost = this.ghosts.get(socketId);
      if (ghost) ghost.sprite.setAlpha(0.2);
    });
  }

  private removeOnlineListeners(): void {
    try {
      const socket = getSocket();
      socket.off("countdown_start");
      socket.off("race_go");
      socket.off("player_moved");
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("game_paused");
      socket.off("game_resumed");
      socket.off("dnf_warning");
      socket.off("track_results");
      socket.off("player_finished");
    } catch {
      // socket may be gone
    }
  }

  private spawnGhost(socketId: string, nickname: string): void {
    const spawn = this.activeTrack.asset.spawn;
    const sprite = this.add.sprite(spawn.x, spawn.y, "car");
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(36, 50);
    sprite.setDepth(8);
    sprite.setAlpha(0.4);
    sprite.setTint(0x88ccff);
    this.uiCamera.ignore(sprite);

    const label = this.add.text(spawn.x, spawn.y - 30, nickname, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#88ccff"
    }).setOrigin(0.5).setDepth(8);
    this.uiCamera.ignore(label);

    this.ghosts.set(socketId, {
      sprite,
      label,
      targetX: spawn.x,
      targetY: spawn.y,
      targetRot: spawn.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET
    });
  }

  private showCountdown(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.countdownText = this.add
      .text(cx, cy, "3", {
        fontFamily: "monospace",
        fontSize: "80px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    let n = 3;
    const tick = () => {
      n--;
      if (n > 0 && this.countdownText) {
        this.countdownText.setText(String(n));
        this.time.delayedCall(1000, tick);
      }
      // race_go event will show "GO!" and clear the text
    };
    this.time.delayedCall(1000, tick);
  }

  private showDnfWarning(secondsLeft: number): void {
    if (!this.dnfText) {
      this.dnfText = this.add
        .text(GAME_WIDTH / 2, 40, "", {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#ff2222",
          stroke: "#000000",
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
    }
    this.dnfText.setText(secondsLeft > 0 ? `DNF in ${secondsLeft}s` : "DNF!");
  }

  update(_time: number, deltaMs: number): void {
    if (this.controlsLocked) return;

    if (Phaser.Input.Keyboard.JustDown(this.controls.restart)) {
      if (this.onlineMode) {
        // Teleport to spawn without resetting timer
        const spawn = this.activeTrack.asset.spawn;
        this.carState = {
          position: { x: spawn.x, y: spawn.y },
          velocity: { x: 0, y: 0 },
          heading: spawn.heading,
          angularVelocity: 0
        };
      } else {
        this.scene.restart();
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.controls.escape)) {
      if (!this.onlineMode && sessionStorage.getItem("swag_is_test_drive") === "true") {
        sessionStorage.removeItem("swag_is_test_drive");
        const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
        window.location.href = `${base}editor`;
        return;
      }
      if (this.onlineMode) {
        getSocket().emit("pause_request");
      } else {
        this.openPause();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.controls.pause)) {
      if (this.onlineMode) {
        getSocket().emit("pause_request");
      } else {
        this.openPause();
      }
      return;
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

    if (this.isDrifting) {
      this.turboCharge = Math.min(
        this.turboCharge + dt * DEFAULT_CAR.turbo.fillRate,
        DEFAULT_CAR.turbo.maxCharge
      );
    }
    if (this.turboExhausted && !this.shiftKey.isDown) {
      this.turboExhausted = false;
    }
    this.turboActive = this.shiftKey.isDown && this.turboCharge > 0 && !this.turboExhausted;
    if (this.turboActive) {
      this.turboCharge = Math.max(this.turboCharge - dt, 0);
      if (this.turboCharge === 0) {
        this.turboExhausted = true;
        this.turboActive = false;
      }
    }

    const onTrack = isOnTrack(this.carState.position.x, this.carState.position.y, this.activeTrack);
    const effectiveHandling = getEffectiveHandling(DEFAULT_CAR, this.turboActive);
    const driftStep = stepDriftModel(this.carState, input, dt, effectiveHandling, !onTrack);
    this.carState = driftStep.state;
    this.isDrifting = driftStep.isDrifting;

    if (!this.timerStarted && driftStep.speed > 2) {
      this.timerStarted = true;
    }
    if (this.timerStarted) {
      this.elapsedMs += deltaMs;
    }

    this.car.setPosition(this.carState.position.x, this.carState.position.y);
    this.car.rotation = this.carState.heading + RaceScene.CAR_SPRITE_HEADING_OFFSET;

    const flameX = this.carState.position.x - Math.cos(this.carState.heading) * 24;
    const flameY = this.carState.position.y - Math.sin(this.carState.heading) * 24;
    this.turboFlame.setPosition(flameX, flameY);
    if (this.turboActive && !this.turboFlame.emitting) {
      this.turboFlame.start();
    } else if (!this.turboActive && this.turboFlame.emitting) {
      this.turboFlame.stop();
    }

    const lookAheadX = this.carState.position.x + this.carState.velocity.x * CAMERA_LOOK_AHEAD_FACTOR;
    const lookAheadY = this.carState.position.y + this.carState.velocity.y * CAMERA_LOOK_AHEAD_FACTOR;
    const targetScrollX = lookAheadX - this.cameras.main.width / 2;
    const targetScrollY = lookAheadY - this.cameras.main.height / 2;
    this.cameras.main.scrollX += (targetScrollX - this.cameras.main.scrollX) * CAMERA_LERP;
    this.cameras.main.scrollY += (targetScrollY - this.cameras.main.scrollY) * CAMERA_LERP;

    const speedFactor = Math.min(1, driftStep.speed / DEFAULT_CAR.handling.maxSpeed);
    const targetZoom = Phaser.Math.Linear(CAMERA_BASE_ZOOM, CAMERA_MIN_ZOOM, speedFactor);
    this.cameras.main.zoom += (targetZoom - this.cameras.main.zoom) * CAMERA_ZOOM_LERP;

    this.updateDriftFx(driftStep.isDrifting, deltaMs);

    const lapUpdate = this.lapTracker.update(previousPosition, this.carState.position, this.elapsedMs);

    const elapsed = Math.round(this.elapsedMs);
    const totalLaps = this.onlineMode && sessionState.online ? sessionState.online.laps : TOTAL_LAPS;
    this.hud.update(
      driftStep.speed,
      lapUpdate.state.lapNumber,
      totalLaps,
      elapsed,
      driftStep.isDrifting
    );

    const turboRatio = DEFAULT_CAR.turbo.maxCharge > 0
      ? Math.min(this.turboCharge / DEFAULT_CAR.turbo.maxCharge, 1)
      : 0;
    this.updateTurboArc(turboRatio, this.turboActive, this.turboExhausted);

    // Ghost lerp (online mode)
    if (this.onlineMode) {
      for (const ghost of this.ghosts.values()) {
        ghost.sprite.x = Phaser.Math.Linear(ghost.sprite.x, ghost.targetX, 0.3);
        ghost.sprite.y = Phaser.Math.Linear(ghost.sprite.y, ghost.targetY, 0.3);
        ghost.sprite.rotation = Phaser.Math.Angle.RotateTo(
          ghost.sprite.rotation,
          ghost.targetRot,
          0.3
        );
        ghost.label.setPosition(ghost.sprite.x, ghost.sprite.y - 30);
      }

      // Broadcast position at ~30 Hz
      this.positionBroadcastMs += deltaMs;
      if (this.positionBroadcastMs >= 33) {
        this.positionBroadcastMs = 0;
        getSocket().volatile.emit("update_position", {
          x: this.carState.position.x,
          y: this.carState.position.y,
          rotation: this.car.rotation
        });
      }
    }

    if (lapUpdate.raceCompleted) {
      if (this.onlineMode) {
        if (!this.raceFinishedSent) {
          this.raceFinishedSent = true;
          getSocket().emit("race_finished", { timeMs: elapsed });
          // Don't navigate — wait for track_results from server
        }
      } else if (lapUpdate.state.bestLapMs !== null) {
        const averageSpeedKmh = this.computeAverageSpeedKmh(elapsed);
        sessionState.result = {
          finalTimeMs: elapsed,
          bestLapMs: Math.round(lapUpdate.state.bestLapMs),
          averageSpeedKmh,
          trackId: this.activeTrack.asset.id
        };
        this.scene.start("result");
      }
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
    const nowMs = this.time.now;
    this.cleanupSkidMarks(nowMs);
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
      this.skidMarks.push({ sprite: mark, createdAtMs: nowMs });
    });
  }

  private updateTurboArc(ratio: number, active: boolean, exhausted: boolean): void {
    const gfx = this.turboArcGfx;
    const cx = this.carState.position.x;
    const BAR_Y = this.carState.position.y + 42;
    const HALF_W = 24;

    gfx.clear();

    gfx.lineStyle(3, 0x111133, 0.5);
    gfx.beginPath();
    gfx.moveTo(cx - HALF_W, BAR_Y);
    gfx.lineTo(cx + HALF_W, BAR_Y);
    gfx.strokePath();

    if (ratio > 0) {
      const color = exhausted ? 0xff3333 : active ? 0x00ffff : 0x4488ff;
      const fillW = HALF_W * 2 * ratio;

      if (active) {
        gfx.lineStyle(7, 0x0066ff, 0.2);
        gfx.beginPath();
        gfx.moveTo(cx - HALF_W, BAR_Y);
        gfx.lineTo(cx - HALF_W + fillW, BAR_Y);
        gfx.strokePath();
      }

      gfx.lineStyle(3, color, 0.9);
      gfx.beginPath();
      gfx.moveTo(cx - HALF_W, BAR_Y);
      gfx.lineTo(cx - HALF_W + fillW, BAR_Y);
      gfx.strokePath();
    }
  }

  private openPause(): void {
    if (this.scene.isActive("pause") || this.scene.isPaused("race")) {
      return;
    }
    this.scene.launch("pause", { from: "race" });
    this.scene.pause();
  }

  private cleanupSkidMarks(nowMs: number): void {
    const cutoff = nowMs - 4500;
    while (this.skidMarks.length > 0 && this.skidMarks[0].createdAtMs <= cutoff) {
      const oldest = this.skidMarks.shift();
      oldest?.sprite.destroy();
    }
  }

  private computeLapDistance(track: RuntimeTrack): number {
    const points = track.geometry.sampledCenterline;
    if (points.length < 2) {
      return 0;
    }
    let distance = 0;
    for (let i = 0; i < points.length; i += 1) {
      const next = points[(i + 1) % points.length];
      const current = points[i];
      distance += Math.hypot(next.x - current.x, next.y - current.y);
    }
    return distance;
  }

  private computeAverageSpeedKmh(elapsedMs: number): number {
    if (elapsedMs <= 0 || this.trackLapDistance <= 0) {
      return 0;
    }
    const totalLaps = this.onlineMode && sessionState.online ? sessionState.online.laps : TOTAL_LAPS;
    const totalDistance = this.trackLapDistance * totalLaps;
    const speed = totalDistance / (elapsedMs / 1000);
    return Number((speed * 0.18).toFixed(1));
  }
}
