import Phaser from "phaser";
import {
  CAMERA_BASE_ZOOM,
  CAMERA_LERP,
  CAMERA_LOOK_AHEAD_FACTOR,
  CAMERA_MIN_ZOOM,
  CAMERA_ZOOM_LERP,
  GAME_HEIGHT,
  GAME_WIDTH,
  TOTAL_LAPS,
} from "../core/constants";
import { DEFAULT_CAR, getEffectiveHandling } from "../core/physics/carHandling";
import { stepDriftModel } from "../core/physics/driftModel";
import { buildTrackGeometry } from "../core/track/geometry";
import { getTrackById } from "../core/track/trackStore";
import type { RuntimeTrack } from "../core/track/types";
import type { CarState, InputState } from "../core/types";
import { socketClient } from "../services/socket/socketClient";

interface PlayerInfo {
  id: string;
  playerName: string;
  isHost: boolean;
}

interface CarSnapshot {
  id: string;
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  lapNumber: number;
  finished: boolean;
  lastInputSeq: number;
}

interface TimestampedSnapshot {
  time: number;
  cars: Map<string, CarSnapshot>;
}

interface BufferedInput {
  seq: number;
  input: InputState;
  dt: number;
  turboActive: boolean;
}

interface SceneData {
  trackId: string;
  spawnPositions: Record<string, { x: number; y: number; heading: number }>;
  myId: string;
  players: PlayerInfo[];
}

const INTERP_DELAY_MS = 100;
const RECONCILE_LERP_MAX = 120;  // up to 120px — smooth lerp
const RECONCILE_SNAP = 300;      // >300px — instant snap
const CAR_HEADING_OFFSET = -Math.PI / 2;
const ROAD_BORDER_PX = 10;

export class MultiplayerRaceScene extends Phaser.Scene {
  private myId!: string;
  private players!: PlayerInfo[];
  private activeTrack!: RuntimeTrack;

  private myCarState!: CarState;
  private myCar!: Phaser.GameObjects.Sprite;

  private remoteCars = new Map<string, Phaser.GameObjects.Sprite>();
  private snapshotBuffer: TimestampedSnapshot[] = [];

  private controls!: {
    throttle: Phaser.Input.Keyboard.Key[];
    brake: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    handbrake: Phaser.Input.Keyboard.Key[];
  };
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private turboCharge = 0;
  private turboActive = false;
  private turboExhausted = false;
  private isDrifting = false;

  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private lapText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private finishedText?: Phaser.GameObjects.Text;

  private inputSeq = 0;
  private elapsedMs = 0;
  private raceStarted = false;
  private myFinished = false;
  private playerLaps = new Map<string, number>();
  private playerFinished = new Map<string, boolean>();

  private skidMarks: { sprite: Phaser.GameObjects.Image; createdAtMs: number }[] = [];
  private driftMarkCooldownMs = 0;
  private clockOffset = 0;  // serverTime - clientTime, estimated at raceStart

  private inputBuffer: BufferedInput[] = [];
  private readonly INPUT_BUFFER_MAX = 120;

  constructor() {
    super("multiplayer_race");
  }

  init(data: SceneData): void {
    this.myId = data.myId ?? socketClient.id ?? "";
    this.players = data.players ?? [];
    for (const p of this.players) {
      this.playerLaps.set(p.id, 1);
      this.playerFinished.set(p.id, false);
    }

    const trackAsset = getTrackById(data.trackId);
    if (!trackAsset) throw new Error(`Track not found: ${data.trackId}`);
    this.activeTrack = trackAsset;

    const spawn = data.spawnPositions[this.myId] ?? trackAsset.asset.spawn;
    this.myCarState = {
      position: { x: spawn.x, y: spawn.y },
      velocity: { x: 0, y: 0 },
      heading: spawn.heading,
      angularVelocity: 0,
    };
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.activeTrack.asset.style.grassColor);
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setScroll(0, 0);

    this.elapsedMs = 0;
    this.raceStarted = false;
    this.myFinished = false;
    this.turboCharge = 0;
    this.turboActive = false;
    this.turboExhausted = false;
    this.clockOffset = 0;
    this.snapshotBuffer = [];
    this.inputBuffer = [];
    this.skidMarks = [];
    this.remoteCars.clear();
    this.playerLaps.clear();
    this.playerFinished.clear();
    this.inputSeq = 0;

    this.drawTrack();
    this.setupCars();
    this.setupControls();
    this.setupHud();
    this.startCountdown();
    this.registerSocketEvents();

    this.cameras.main.centerOn(this.myCarState.position.x, this.myCarState.position.y);
    this.cameras.main.setZoom(CAMERA_BASE_ZOOM);

    this.events.once("shutdown", () => this.cleanup());
  }

  private setupCars(): void {
    // Remote cars first (behind own)
    for (const p of this.players) {
      if (p.id === this.myId) continue;
      const sprite = this.add.sprite(0, 0, "car");
      sprite.setDisplaySize(36, 50);
      sprite.setDepth(9);
      sprite.setAlpha(0.85);
      sprite.setTint(0xff9944);
      this.uiCamera.ignore(sprite);
      this.remoteCars.set(p.id, sprite);
      this.playerLaps.set(p.id, 1);
      this.playerFinished.set(p.id, false);
    }

    // Own car
    this.myCar = this.add.sprite(this.myCarState.position.x, this.myCarState.position.y, "car");
    this.myCar.setDisplaySize(36, 50);
    this.myCar.setDepth(10);
    this.uiCamera.ignore(this.myCar);
  }

  private setupControls(): void {
    const kb = this.input.keyboard!;
    this.controls = {
      throttle: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.W), kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP)],
      brake: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.S), kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)],
      left: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.A), kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)],
      right: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.D), kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)],
      handbrake: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)],
    };
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  private setupHud(): void {
    const style = { fontFamily: "monospace", fontSize: "20px", color: "#d0f0ff" };

    this.lapText = this.add.text(20, 20, "Lap 1/3", { ...style, fontSize: "24px" });
    this.timerText = this.add.text(20, 54, "0:00.000", style);
    this.speedText = this.add.text(20, 82, "0 km/h", style);

    this.cameras.main.ignore([this.lapText, this.timerText, this.speedText]);

    this.refreshPlayerList();
  }

  private refreshPlayerList(): void {
    this.playerListTexts.forEach((t) => t.destroy());
    this.playerListTexts = [];

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const lap = this.playerLaps.get(p.id) ?? 1;
      const done = this.playerFinished.get(p.id) ? " ✓" : "";
      const isMe = p.id === this.myId;
      const label = `${p.playerName}${isMe ? "*" : ""} L${lap}${done}`;
      const t = this.add.text(GAME_WIDTH - 20, 20 + i * 28, label, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: isMe ? "#ffd166" : "#93c5fd",
      }).setOrigin(1, 0);
      this.playerListTexts.push(t);
      this.cameras.main.ignore(t);
    }
  }

  private startCountdown(): void {
    this.countdownText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "3", {
      fontFamily: "monospace",
      fontSize: "120px",
      color: "#ffd166",
    }).setOrigin(0.5);
    this.cameras.main.ignore(this.countdownText);

    let count = 3;
    const tick = () => {
      count--;
      if (count > 0) {
        this.countdownText?.setText(String(count));
        this.time.delayedCall(1000, tick);
      } else {
        this.countdownText?.setText("GO!");
        this.time.delayedCall(600, () => {
          this.countdownText?.destroy();
          this.countdownText = undefined;
        });
        this.raceStarted = true;
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private registerSocketEvents(): void {
    socketClient.on("snapshot", (data: unknown) => {
      const snap = data as { seq: number; serverTime: number; cars: CarSnapshot[] };
      const entry: TimestampedSnapshot = {
        time: snap.serverTime,
        cars: new Map(snap.cars.map((c) => [c.id, c])),
      };
      this.snapshotBuffer.push(entry);
      if (this.snapshotBuffer.length > 20) this.snapshotBuffer.shift();

      // Reconcile own car
      const mine = entry.cars.get(this.myId);
      if (mine && !this.myFinished) {
        const dx = mine.x - this.myCarState.position.x;
        const dy = mine.y - this.myCarState.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > RECONCILE_SNAP) {
          // Hard correction: apply server state then replay unconfirmed inputs
          this.myCarState = {
            position: { x: mine.x, y: mine.y },
            velocity: { x: mine.vx, y: mine.vy },
            heading: mine.heading,
            angularVelocity: mine.angularVelocity,
          };
          this.replayInputsAfter(mine.lastInputSeq);
        } else if (dist > 5) {
          // Soft correction: lerp toward server
          const alpha = Math.min(dist / RECONCILE_LERP_MAX, 1) * 0.15;
          this.myCarState.position.x += dx * alpha;
          this.myCarState.position.y += dy * alpha;
          this.myCarState.velocity.x = Phaser.Math.Linear(this.myCarState.velocity.x, mine.vx, alpha);
          this.myCarState.velocity.y = Phaser.Math.Linear(this.myCarState.velocity.y, mine.vy, alpha);
          const dAngle = Phaser.Math.Angle.Wrap(mine.heading - this.myCarState.heading);
          this.myCarState.heading += dAngle * alpha;
        }
      }
    });

    socketClient.on("lapComplete", (data: unknown) => {
      const { playerId, lapNumber } = data as { playerId: string; lapNumber: number; lapTimeMs: number };
      this.playerLaps.set(playerId, lapNumber + 1);
      if (playerId === this.myId) {
        this.lapText.setText(`Lap ${lapNumber + 1}/${TOTAL_LAPS}`);
      }
      this.refreshPlayerList();
    });

    socketClient.on("playerFinished", (data: unknown) => {
      const { playerId } = data as { playerId: string; totalTimeMs: number; position: number };
      this.playerFinished.set(playerId, true);
      if (playerId === this.myId) {
        this.myFinished = true;
        this.finishedText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "FINISHED!", {
          fontFamily: "monospace",
          fontSize: "72px",
          color: "#4ade80",
        }).setOrigin(0.5);
        this.cameras.main.ignore(this.finishedText);
      }
      this.refreshPlayerList();
    });

    socketClient.on("raceEnd", (data: unknown) => {
      const { results, hostId } = data as { results: Array<{ playerId: string; playerName: string; position: number; totalTimeMs: number }>; hostId: string };
      this.cleanup();
      this.scene.start("multiplayer_result", { results, myId: this.myId, hostId, players: this.players });
    });

    socketClient.on("playerLeft", (data: unknown) => {
      const { id } = data as { id: string };
      const sprite = this.remoteCars.get(id);
      if (sprite) {
        sprite.destroy();
        this.remoteCars.delete(id);
      }
      this.players = this.players.filter((p) => p.id !== id);
      this.refreshPlayerList();
    });

    socketClient.on("raceStart", (data: unknown) => {
      const { serverTime } = data as { serverTime: number };
      this.clockOffset = serverTime - Date.now();
    });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.raceStarted || this.myFinished) {
      this.interpolateRemoteCars();
      return;
    }

    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const pressed = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);

    const input: InputState = {
      throttle: pressed(this.controls.throttle) ? 1 : 0,
      brake: pressed(this.controls.brake) ? 1 : 0,
      steer: (pressed(this.controls.right) ? 1 : 0) - (pressed(this.controls.left) ? 1 : 0),
      handbrake: pressed(this.controls.handbrake),
    };

    // Turbo
    if (this.isDrifting) {
      this.turboCharge = Math.min(
        this.turboCharge + dt * DEFAULT_CAR.turbo.fillRate,
        DEFAULT_CAR.turbo.maxCharge
      );
    }
    if (this.turboExhausted && !this.shiftKey.isDown) this.turboExhausted = false;
    this.turboActive = this.shiftKey.isDown && this.turboCharge > 0 && !this.turboExhausted;
    if (this.turboActive) {
      this.turboCharge = Math.max(this.turboCharge - dt, 0);
      if (this.turboCharge === 0) {
        this.turboExhausted = true;
        this.turboActive = false;
      }
    }

    const handling = getEffectiveHandling(DEFAULT_CAR, this.turboActive);
    const step = stepDriftModel(this.myCarState, input, dt, handling, false);
    this.myCarState = step.state;
    this.isDrifting = step.isDrifting;

    // Send input to server
    socketClient.emit("playerInput", {
      seq: this.inputSeq++,
      throttle: input.throttle,
      brake: input.brake,
      steer: input.steer,
      handbrake: input.handbrake,
      turbo: this.turboActive,
    });
    this.inputBuffer.push({ seq: this.inputSeq - 1, input: { ...input }, dt, turboActive: this.turboActive });
    if (this.inputBuffer.length > this.INPUT_BUFFER_MAX) this.inputBuffer.shift();

    this.elapsedMs += deltaMs;

    // Update own car sprite
    this.myCar.setPosition(this.myCarState.position.x, this.myCarState.position.y);
    this.myCar.rotation = this.myCarState.heading + CAR_HEADING_OFFSET;

    // Skid marks
    this.updateSkidMarks(step.isDrifting, deltaMs);

    // Camera
    const lookX = this.myCarState.position.x + this.myCarState.velocity.x * CAMERA_LOOK_AHEAD_FACTOR;
    const lookY = this.myCarState.position.y + this.myCarState.velocity.y * CAMERA_LOOK_AHEAD_FACTOR;
    this.cameras.main.scrollX += (lookX - GAME_WIDTH / 2 - this.cameras.main.scrollX) * CAMERA_LERP;
    this.cameras.main.scrollY += (lookY - GAME_HEIGHT / 2 - this.cameras.main.scrollY) * CAMERA_LERP;
    const speedFactor = Math.min(1, step.speed / DEFAULT_CAR.handling.maxSpeed);
    const targetZoom = Phaser.Math.Linear(CAMERA_BASE_ZOOM, CAMERA_MIN_ZOOM, speedFactor);
    this.cameras.main.zoom += (targetZoom - this.cameras.main.zoom) * CAMERA_ZOOM_LERP;

    // HUD
    const km = Math.round(step.speed * 0.5);
    this.speedText.setText(`${km} km/h`);
    const s = Math.floor(this.elapsedMs / 1000);
    const ms = Math.floor(this.elapsedMs % 1000);
    this.timerText.setText(`${s}:${String(ms).padStart(3, "0")}`);

    this.interpolateRemoteCars();
  }

  private interpolateRemoteCars(): void {
    const renderTime = Date.now() + this.clockOffset - INTERP_DELAY_MS;
    if (this.snapshotBuffer.length < 2) return;

    for (const [id, sprite] of this.remoteCars) {
      let prev: TimestampedSnapshot | null = null;
      let next: TimestampedSnapshot | null = null;

      for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
        if (
          this.snapshotBuffer[i].time <= renderTime &&
          this.snapshotBuffer[i + 1].time >= renderTime
        ) {
          prev = this.snapshotBuffer[i];
          next = this.snapshotBuffer[i + 1];
          break;
        }
      }

      if (!prev || !next) {
        const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1].cars.get(id);
        if (latest) {
          sprite.setPosition(latest.x, latest.y);
          sprite.rotation = latest.heading + CAR_HEADING_OFFSET;
        }
        continue;
      }

      const t = (renderTime - prev.time) / (next.time - prev.time);
      const a = prev.cars.get(id);
      const b = next.cars.get(id);
      if (!a || !b) continue;

      sprite.setPosition(
        Phaser.Math.Linear(a.x, b.x, t),
        Phaser.Math.Linear(a.y, b.y, t)
      );
      const dAngle = Phaser.Math.Angle.Wrap(b.heading - a.heading);
      sprite.rotation = a.heading + dAngle * t + CAR_HEADING_OFFSET;
    }
  }

  private replayInputsAfter(lastConfirmedSeq: number): void {
    const pending = this.inputBuffer.filter((b) => b.seq > lastConfirmedSeq);
    for (const buffered of pending) {
      const handling = getEffectiveHandling(DEFAULT_CAR, buffered.turboActive);
      const result = stepDriftModel(this.myCarState, buffered.input, buffered.dt, handling, false);
      this.myCarState = result.state;
    }
  }

  private drawTrack(): void {
    const gfx = this.add.graphics();
    const assetStyle = this.activeTrack.asset.style;
    const grassColor = parseInt(assetStyle.grassColor.replace("#", ""), 16);
    const asphaltColor = parseInt(assetStyle.asphaltColor.replace("#", ""), 16);
    const borderColor = parseInt(assetStyle.borderColor.replace("#", ""), 16);

    const bounds = this.activeTrack.geometry.bounds;
    const margin = 2000;
    gfx.fillStyle(grassColor, 1);
    gfx.fillRect(bounds.minX - margin, bounds.minY - margin, bounds.maxX - bounds.minX + margin * 2, bounds.maxY - bounds.minY + margin * 2);

    const borderGeom = buildTrackGeometry({
      ...this.activeTrack.asset,
      roadWidth: this.activeTrack.asset.roadWidth + ROAD_BORDER_PX * 2,
    });
    gfx.fillStyle(borderColor, 1);
    borderGeom.quads.forEach((q) => gfx.fillPoints(q, true));

    gfx.fillStyle(asphaltColor, 1);
    this.activeTrack.geometry.quads.forEach((q) => gfx.fillPoints(q, true));

    gfx.lineStyle(3, 0xf8fafc, 0.35);
    gfx.strokePoints(this.activeTrack.geometry.sampledCenterline, true);

    this.activeTrack.asset.checkpoints.forEach((cp, i) => {
      gfx.lineStyle(i === 0 ? 6 : 4, i === 0 ? 0xffffff : 0xffcc00, i === 0 ? 1 : 0.55);
      gfx.lineBetween(cp.a.x, cp.a.y, cp.b.x, cp.b.y);
    });

    this.uiCamera.ignore(gfx);
  }

  private updateSkidMarks(isDrifting: boolean, deltaMs: number): void {
    const nowMs = this.time.now;
    this.skidMarks = this.skidMarks.filter((m) => {
      if (nowMs - m.createdAtMs > 4500) { m.sprite.destroy(); return false; }
      m.sprite.setAlpha(Math.max(0, 1 - (nowMs - m.createdAtMs) / 4500));
      return true;
    });

    this.driftMarkCooldownMs -= deltaMs;
    if (!isDrifting || this.driftMarkCooldownMs > 0) return;
    this.driftMarkCooldownMs = 45;

    const mark = this.add.image(this.myCarState.position.x, this.myCarState.position.y, "skid_mark");
    mark.setRotation(this.myCarState.heading);
    mark.setAlpha(0.6);
    mark.setDepth(1);
    this.uiCamera.ignore(mark);
    this.skidMarks.push({ sprite: mark, createdAtMs: nowMs });
  }

  private cleanup(): void {
    socketClient.off("snapshot");
    socketClient.off("lapComplete");
    socketClient.off("playerFinished");
    socketClient.off("raceEnd");
    socketClient.off("playerLeft");
    socketClient.off("raceStart");
  }
}
