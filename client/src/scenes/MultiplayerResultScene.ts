import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../core/constants";
import { socketClient } from "../services/socket/socketClient";
import { formatTime } from "../services/api/leaderboardApi";

interface RaceResultEntry {
  playerId: string;
  playerName: string;
  position: number;
  totalTimeMs: number;
}

interface PlayerInfo {
  id: string;
  playerName: string;
  isHost: boolean;
}

interface SceneData {
  results: RaceResultEntry[];
  myId: string;
  hostId: string;
  players: PlayerInfo[];
}

export class MultiplayerResultScene extends Phaser.Scene {
  private results: RaceResultEntry[] = [];
  private myId = "";
  private isHost = false;
  private players: PlayerInfo[] = [];
  private startButton?: Phaser.GameObjects.Text;
  private waitingText?: Phaser.GameObjects.Text;

  constructor() {
    super("multiplayer_result");
  }

  init(data: SceneData): void {
    this.results = data.results ?? [];
    this.myId = data.myId ?? "";
    this.players = data.players ?? [];
    this.isHost = (data.hostId ?? "") === this.myId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0c1018");

    this.add.text(GAME_WIDTH / 2, 60, "RACE RESULTS", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ffd166",
    }).setOrigin(0.5);

    const medals = ["🥇", "🥈", "🥉"];

    this.results.forEach((entry, i) => {
      const isMe = entry.playerId === this.myId;
      const medal = medals[i] ?? `${entry.position}.`;
      const time = formatTime(entry.totalTimeMs);
      const label = `${medal}  ${entry.playerName}${isMe ? " (you)" : ""}   ${time}`;

      this.add.text(GAME_WIDTH / 2, 160 + i * 56, label, {
        fontFamily: "monospace",
        fontSize: "28px",
        color: isMe ? "#ffd166" : "#d0f0ff",
      }).setOrigin(0.5);
    });

    this.registerSocketEvents();
    this.refreshHostControls();

    const leaveBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 80, "[ LEAVE ROOM ]", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#64748b",
      backgroundColor: "#172034",
      padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    leaveBtn.on("pointerdown", () => {
      socketClient.disconnect();
      this.cleanup();
      this.scene.start("menu");
    });

  }

  private registerSocketEvents(): void {
    socketClient.on("hostChanged", (data: unknown) => {
      const { hostId } = data as { hostId: string };
      this.isHost = hostId === this.myId;
      this.players = this.players.map((p) => ({ ...p, isHost: p.id === hostId }));
      this.refreshHostControls();
    });

    socketClient.on("playerLeft", (data: unknown) => {
      const { id } = data as { id: string };
      this.players = this.players.filter((p) => p.id !== id);
    });

    socketClient.on("roomState", (data: unknown) => {
      const state = data as { hostId: string; players?: PlayerInfo[] };
      this.isHost = state.hostId === this.myId;
      if (state.players) this.players = state.players;
      this.refreshHostControls();
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
        myId: this.myId,
        players: this.players,
      });
    });
  }

  private refreshHostControls(): void {
    this.startButton?.destroy();
    this.waitingText?.destroy();

    if (this.isHost) {
      this.startButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, "[ NEXT ROUND ]", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#4ade80",
        backgroundColor: "#172034",
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.startButton.on("pointerdown", () => {
        socketClient.emit("startRace");
      });
    } else {
      this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 140, "Waiting for host...", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#64748b",
      }).setOrigin(0.5);
    }
  }

  private cleanup(): void {
    socketClient.off("hostChanged");
    socketClient.off("playerLeft");
    socketClient.off("roomState");
    socketClient.off("startCountdown");
  }
}
