import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../core/constants";
import { getPlayerName, setPlayerName } from "../state/playerProfile";
import { socketClient } from "../services/socket/socketClient";

interface PlayerInfo {
  id: string;
  playerName: string;
  isHost: boolean;
}

interface RoomState {
  code: string;
  players: PlayerInfo[];
  hostId: string;
  trackId: string;
  phase: string;
  availableTracks: string[];
}

export class MultiplayerLobbyScene extends Phaser.Scene {
  private formEl: HTMLDivElement | null = null;
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private trackPickerTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private startButton?: Phaser.GameObjects.Text;
  private waitingText?: Phaser.GameObjects.Text;
  private leaveButton?: Phaser.GameObjects.Text;

  private roomState: RoomState | null = null;
  private isInRoom = false;

  constructor() {
    super("multiplayer_lobby");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0c1018");
    this.isInRoom = false;
    this.roomState = null;

    this.add.text(GAME_WIDTH / 2, 60, "MULTIPLAYER", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#d0f0ff",
    }).setOrigin(0.5);

    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, "", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#ef4444",
    }).setOrigin(0.5);

    socketClient.connect();
    this.buildForm();
    this.registerSocketEvents();

    this.events.once("shutdown", () => this.cleanup());
    this.events.once("destroy", () => this.cleanup());
  }

  private buildForm(): void {
    const form = document.createElement("div");
    form.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      font-family: monospace;
      z-index: 100;
    `;

    const inputStyle = `
      background: #172034;
      border: 2px solid #334155;
      color: #d0f0ff;
      font-family: monospace;
      font-size: 22px;
      padding: 10px 16px;
      text-align: center;
      outline: none;
      width: 260px;
      letter-spacing: 4px;
    `;

    const label1 = document.createElement("label");
    label1.textContent = "Room Code (4 digits)";
    label1.style.cssText = "color: #93c5fd; font-size: 14px; letter-spacing: 2px;";

    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.maxLength = 4;
    codeInput.placeholder = "1234";
    codeInput.style.cssText = inputStyle;
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 4);
    });

    const label2 = document.createElement("label");
    label2.textContent = "Player Name";
    label2.style.cssText = "color: #93c5fd; font-size: 14px; letter-spacing: 2px;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 20;
    nameInput.value = getPlayerName() ?? "";
    nameInput.style.cssText = inputStyle + "letter-spacing: 1px;";

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "JOIN / CREATE ROOM";
    joinBtn.style.cssText = `
      background: #172034;
      border: 2px solid #ffd166;
      color: #ffd166;
      font-family: monospace;
      font-size: 20px;
      padding: 12px 28px;
      cursor: pointer;
      margin-top: 8px;
    `;
    joinBtn.addEventListener("click", () => {
      const code = codeInput.value.trim();
      const name = nameInput.value.trim() || "Player";
      if (code.length !== 4) {
        this.statusText.setText("Enter a 4-digit room code");
        return;
      }
      setPlayerName(name);
      this.statusText.setText("Connecting...");
      joinBtn.disabled = true;

      const socket = socketClient.connect();
      if (socket.connected) {
        socketClient.emit("joinRoom", { code, playerName: name });
      } else {
        socket.once("connect", () => {
          socketClient.emit("joinRoom", { code, playerName: name });
        });
      }
    });

    const backBtn = document.createElement("button");
    backBtn.textContent = "← BACK";
    backBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #64748b;
      font-family: monospace;
      font-size: 16px;
      padding: 8px;
      cursor: pointer;
      margin-top: 4px;
    `;
    backBtn.addEventListener("click", () => {
      this.goBack();
    });

    form.appendChild(label1);
    form.appendChild(codeInput);
    form.appendChild(label2);
    form.appendChild(nameInput);
    form.appendChild(joinBtn);
    form.appendChild(backBtn);

    document.body.appendChild(form);
    this.formEl = form;
  }

  private registerSocketEvents(): void {
    socketClient.on("roomState", (data: unknown) => {
      const state = data as RoomState;
      this.roomState = state;
      this.isInRoom = true;
      this.removeForm();
      this.buildRoomUI();
    });

    socketClient.on("playerJoined", (data: unknown) => {
      const p = data as PlayerInfo;
      if (this.roomState) {
        this.roomState.players.push(p);
        this.refreshPlayerList();
      }
    });

    socketClient.on("playerLeft", (data: unknown) => {
      const { id } = data as { id: string };
      if (this.roomState) {
        this.roomState.players = this.roomState.players.filter((p) => p.id !== id);
        this.refreshPlayerList();
      }
    });

    socketClient.on("hostChanged", (data: unknown) => {
      const { hostId } = data as { hostId: string };
      if (this.roomState) {
        this.roomState.hostId = hostId;
        this.roomState.players.forEach((p) => { p.isHost = p.id === hostId; });
        this.refreshPlayerList();
        this.refreshHostControls();
      }
    });

    socketClient.on("trackChanged", (data: unknown) => {
      const { trackId } = data as { trackId: string };
      if (this.roomState) {
        this.roomState.trackId = trackId;
        this.refreshTrackPicker();
      }
    });

    socketClient.on("startCountdown", (data: unknown) => {
      const { trackId, spawnPositions } = data as {
        trackId: string;
        spawnPositions: Record<string, { x: number; y: number; heading: number }>;
      };
      this.cleanup();
      this.scene.start("multiplayer_race", {
        trackId,
        spawnPositions,
        myId: socketClient.id ?? "",
        players: this.roomState?.players ?? [],
      });
    });

    socketClient.on("joinError", (data: unknown) => {
      const { message } = data as { message: string };
      this.statusText.setText(message);
    });
  }

  private buildRoomUI(): void {
    if (!this.roomState) return;

    this.add.text(GAME_WIDTH / 2, 130, `ROOM: ${this.roomState.code}`, {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#ffd166",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 175, "Players:", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#93c5fd",
    }).setOrigin(0.5);

    this.refreshPlayerList();
    this.buildTrackPicker();
    this.refreshHostControls();

    this.leaveButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 80, "[ LEAVE ROOM ]", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#64748b",
      backgroundColor: "#172034",
      padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.leaveButton.on("pointerdown", () => this.goBack());
  }

  private refreshPlayerList(): void {
    this.playerListTexts.forEach((t) => t.destroy());
    this.playerListTexts = [];
    if (!this.roomState) return;

    this.roomState.players.forEach((p, i) => {
      const crown = p.isHost ? "♛ " : "  ";
      const isMe = p.id === socketClient.id;
      const label = `${crown}${p.playerName}${isMe ? " (you)" : ""}`;
      const t = this.add.text(GAME_WIDTH / 2, 210 + i * 36, label, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: isMe ? "#ffd166" : "#d0f0ff",
      }).setOrigin(0.5);
      this.playerListTexts.push(t);
    });
  }

  private buildTrackPicker(): void {
    this.refreshTrackPicker();
  }

  private refreshTrackPicker(): void {
    this.trackPickerTexts.forEach((t) => t.destroy());
    this.trackPickerTexts = [];
    if (!this.roomState) return;

    const isHost = this.roomState.hostId === socketClient.id;
    const tracks = this.roomState.availableTracks;
    const y = 460;

    const label = this.add.text(GAME_WIDTH / 2, y, `Track: ${this.roomState.trackId}`, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#93c5fd",
    }).setOrigin(0.5);
    this.trackPickerTexts.push(label);

    if (isHost) {
      tracks.forEach((id, i) => {
        const isCurrent = id === this.roomState!.trackId;
        const btn = this.add.text(
          GAME_WIDTH / 2 + (i - Math.floor(tracks.length / 2)) * 180,
          y + 40,
          `[${id}]`,
          {
            fontFamily: "monospace",
            fontSize: "16px",
            color: isCurrent ? "#ffd166" : "#475569",
            backgroundColor: "#172034",
            padding: { left: 8, right: 8, top: 4, bottom: 4 },
          }
        ).setOrigin(0.5).setInteractive({ useHandCursor: true });

        if (!isCurrent) {
          btn.on("pointerdown", () => {
            socketClient.emit("pickTrack", { trackId: id });
          });
        }
        this.trackPickerTexts.push(btn);
      });
    }
  }

  private refreshHostControls(): void {
    this.startButton?.destroy();
    this.waitingText?.destroy();

    const isHost = this.roomState?.hostId === socketClient.id;

    if (isHost) {
      this.startButton = this.add.text(GAME_WIDTH / 2, 560, "[ START RACE ]", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#4ade80",
        backgroundColor: "#172034",
        padding: { left: 16, right: 16, top: 10, bottom: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.startButton.on("pointerdown", () => {
        socketClient.emit("startRace");
      });
    } else {
      this.waitingText = this.add.text(GAME_WIDTH / 2, 560, "Waiting for host to start...", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#64748b",
      }).setOrigin(0.5);
    }
  }

  private removeForm(): void {
    if (this.formEl) {
      document.body.removeChild(this.formEl);
      this.formEl = null;
    }
  }

  private goBack(): void {
    socketClient.disconnect();
    this.cleanup();
    this.scene.start("menu");
  }

  private cleanup(): void {
    this.removeForm();
    socketClient.off("roomState");
    socketClient.off("playerJoined");
    socketClient.off("playerLeft");
    socketClient.off("hostChanged");
    socketClient.off("trackChanged");
    socketClient.off("startCountdown");
    socketClient.off("joinError");
  }
}
