import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
import { getTracks } from "../core/track/trackStore";
import { getSocket, disconnectSocket } from "../services/socket";
import type { RoomSnapshot, RoomSummary } from "../services/socketEvents";
import { getPlayerName } from "../state/playerProfile";
import { sessionState } from "../state/session";

export class OnlineLobbyScene extends Phaser.Scene {
  private roomList: RoomSummary[] = [];
  private currentRoom: RoomSnapshot | null = null;
  private isHost = false;
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private settingsDialog: HTMLDivElement | null = null;
  private errorText?: Phaser.GameObjects.Text;

  constructor() {
    super("online_lobby");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b1222");
    this.currentRoom = null;
    this.isHost = false;
    this.showBrowse();
    this.registerSocketListeners();
  }

  shutdown(): void {
    this.clearUi();
    this.cleanupSettingsDialog();
    this.removeSocketListeners();
  }

  private registerSocketListeners(): void {
    const socket = getSocket();

    socket.on("rooms_list", (rooms) => {
      this.roomList = rooms;
      if (!this.currentRoom) this.showBrowse();
    });

    socket.on("player_joined", (player) => {
      if (!this.currentRoom) return;
      if (!this.currentRoom.players.some((p) => p.socketId === player.socketId)) {
        this.currentRoom.players.push(player);
        this.currentRoom.playerCount = this.currentRoom.players.length;
      }
      this.showLobby(this.currentRoom);
    });

    socket.on("player_left", ({ socketId, newHostId }) => {
      if (!this.currentRoom) return;
      this.currentRoom.players = this.currentRoom.players.filter(
        (p) => p.socketId !== socketId
      );
      this.currentRoom.playerCount = this.currentRoom.players.length;
      if (newHostId) {
        this.currentRoom.hostNickname =
          this.currentRoom.players.find((p) => p.socketId === newHostId)
            ?.nickname ?? this.currentRoom.hostNickname;
        if (newHostId === socket.id) {
          this.isHost = true;
        }
      }
      this.showLobby(this.currentRoom);
    });

    socket.on("game_starting", ({ trackList, settings }) => {
      if (!sessionState.online) return;
      sessionState.online.trackList = trackList;
      sessionState.online.currentTrackIndex = 0;
      sessionState.online.laps = settings.laps;
      sessionState.online.active = true;
      sessionState.online.players = this.currentRoom?.players ?? [];
      this.scene.start("race", { onlineMode: true });
    });
  }

  private removeSocketListeners(): void {
    try {
      const socket = getSocket();
      socket.off("rooms_list");
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("game_starting");
    } catch {
      // socket may be gone
    }
  }

  private clearUi(): void {
    this.uiElements.forEach((el) => el.destroy());
    this.uiElements = [];
  }

  private add_tracked<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiElements.push(obj);
    return obj;
  }

  private showBrowse(): void {
    this.clearUi();

    this.add_tracked(
      this.add.text(GAME_WIDTH / 2, 50, "ONLINE LOBBY", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#22d3ee"
      }).setOrigin(0.5)
    );

    this.add_tracked(
      this.add
        .text(120, 115, "[ REFRESH ]", {
          fontFamily: "monospace",
          fontSize: "22px",
          color: "#a7f3d0",
          backgroundColor: "#172034",
          padding: { left: 10, right: 10, top: 5, bottom: 5 }
        })
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          getSocket().emit("list_rooms");
        })
    );

    const backBtn = this.add_tracked(
      this.add
        .text(GAME_WIDTH - 120, 115, "[ BACK ]", {
          fontFamily: "monospace",
          fontSize: "22px",
          color: "#f87171",
          backgroundColor: "#172034",
          padding: { left: 10, right: 10, top: 5, bottom: 5 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
    );
    backBtn.on("pointerdown", () => {
      disconnectSocket();
      sessionState.online = null;
      this.scene.start("menu");
    });

    this.add_tracked(
      this.add.text(120, 155, "─".repeat(60), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#374151"
      })
    );

    if (this.roomList.length === 0) {
      this.add_tracked(
        this.add.text(GAME_WIDTH / 2, 230, "No open rooms. Create one!", {
          fontFamily: "monospace",
          fontSize: "24px",
          color: "#6b7280"
        }).setOrigin(0.5)
      );
    } else {
      let y = 175;
      for (const room of this.roomList) {
        const statusColor =
          room.status === "waiting" ? "#a7f3d0" : "#6b7280";
        const canJoin = room.status === "waiting" && room.playerCount < 8;

        this.add_tracked(
          this.add.text(
            120,
            y,
            `${room.hostNickname}'s room   ${room.status}   ${room.playerCount}/8`,
            {
              fontFamily: "monospace",
              fontSize: "20px",
              color: statusColor
            }
          )
        );

        if (canJoin) {
          const joinBtn = this.add_tracked(
            this.add
              .text(GAME_WIDTH - 150, y, "[ JOIN ]", {
                fontFamily: "monospace",
                fontSize: "20px",
                color: "#ffd166",
                backgroundColor: "#172034",
                padding: { left: 8, right: 8, top: 4, bottom: 4 }
              })
              .setOrigin(0.5)
              .setInteractive({ useHandCursor: true })
          );
          joinBtn.on("pointerdown", () => this.handleJoin(room.id));
        }

        y += 44;
      }
    }

    this.add_tracked(
      this.add.text(120, GAME_HEIGHT - 90, "─".repeat(60), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#374151"
      })
    );

    this.add_tracked(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 55, "[ CREATE LOBBY ]", {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#ffd166",
          backgroundColor: "#172034",
          padding: { left: 14, right: 14, top: 8, bottom: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.openSettingsDialog())
    );

    this.errorText = this.add_tracked(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, "", {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#f87171"
        })
        .setOrigin(0.5)
    ) as Phaser.GameObjects.Text;

    // Auto-refresh room list on open
    getSocket().emit("list_rooms");
  }

  private showLobby(room: RoomSnapshot): void {
    this.currentRoom = room;
    this.clearUi();

    this.add_tracked(
      this.add
        .text(GAME_WIDTH / 2, 50, `${room.hostNickname}'s lobby`, {
          fontFamily: "monospace",
          fontSize: "36px",
          color: "#22d3ee"
        })
        .setOrigin(0.5)
    );

    this.add_tracked(
      this.add.text(120, 105, "─".repeat(60), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#374151"
      })
    );

    this.add_tracked(
      this.add.text(120, 125, `Players (${room.players.length}/8):`, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#d1d5db"
      })
    );

    const socket = getSocket();
    let y = 160;
    for (const player of room.players) {
      const isRoomHost = player.nickname === room.hostNickname;
      const isMe = player.socketId === socket.id;
      const label = `${isRoomHost ? "★ " : "  "}${player.nickname}${isMe ? " (you)" : ""}`;
      this.add_tracked(
        this.add.text(140, y, label, {
          fontFamily: "monospace",
          fontSize: "20px",
          color: isRoomHost ? "#ffd166" : "#e5e7eb"
        })
      );
      y += 32;
    }

    this.add_tracked(
      this.add.text(120, y + 10, "─".repeat(60), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#374151"
      })
    );

    this.add_tracked(
      this.add.text(
        120,
        y + 40,
        `Tracks: ${room.settings.trackCount}   Laps: ${room.settings.laps}`,
        {
          fontFamily: "monospace",
          fontSize: "22px",
          color: "#9ca3af"
        }
      )
    );

    if (this.isHost) {
      this.add_tracked(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 110, "[ LAUNCH GAME ]", {
            fontFamily: "monospace",
            fontSize: "36px",
            color: "#86efac",
            backgroundColor: "#172034",
            padding: { left: 14, right: 14, top: 8, bottom: 8 }
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.handleLaunch())
      );
    } else {
      this.add_tracked(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 110, "Waiting for host to launch...", {
            fontFamily: "monospace",
            fontSize: "24px",
            color: "#6b7280"
          })
          .setOrigin(0.5)
      );
    }

    this.add_tracked(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, "[ LEAVE ]", {
          fontFamily: "monospace",
          fontSize: "26px",
          color: "#f87171",
          backgroundColor: "#172034",
          padding: { left: 12, right: 12, top: 6, bottom: 6 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          disconnectSocket();
          sessionState.online = null;
          this.scene.start("menu");
        })
    );
  }

  private handleJoin(roomId: string): void {
    const nickname = getPlayerName() ?? "RACER";
    getSocket().emit("join_room", { roomId, nickname }, (result) => {
      if (result.ok && result.room) {
        this.isHost = false;
        this.currentRoom = result.room;
        if (sessionState.online) {
          sessionState.online.roomId = roomId;
          sessionState.online.mySocketId = getSocket().id ?? null;
        }
        this.showLobby(result.room);
      } else {
        this.errorText?.setText(result.error ?? "Failed to join room.");
      }
    });
  }

  private handleLaunch(): void {
    const trackIds = getTracks().map((t) => t.asset.id);
    getSocket().emit("launch_game", { availableTrackIds: trackIds });
  }

  private openSettingsDialog(): void {
    if (this.settingsDialog) return;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(11,18,34,0.85);
      display:flex;align-items:center;justify-content:center;
      z-index:9999;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background:#1e2d45;border:2px solid #22d3ee;padding:32px 40px;
      font-family:monospace;color:#f8fafc;text-align:center;min-width:340px;
    `;

    const title = document.createElement("div");
    title.textContent = "Lobby Settings";
    title.style.cssText = "font-size:22px;margin-bottom:24px;color:#22d3ee;";

    const makeRow = (labelText: string, min: number, max: number, defaultVal: number) => {
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:16px;display:flex;align-items:center;gap:12px;justify-content:center;";
      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.cssText = "font-size:18px;min-width:100px;text-align:right;";
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.value = String(defaultVal);
      input.style.cssText = `
        background:#0b1222;border:1px solid #4b5563;color:#f8fafc;
        font-family:monospace;font-size:20px;padding:6px 10px;
        width:70px;outline:none;text-align:center;
      `;
      row.appendChild(label);
      row.appendChild(input);
      return { row, input };
    };

    const { row: trackRow, input: trackInput } = makeRow("Tracks:", 1, 4, 3);
    const { row: lapRow, input: lapInput } = makeRow("Laps:", 1, 10, 3);

    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "font-size:14px;color:#f87171;min-height:18px;margin-bottom:8px;";

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:16px;justify-content:center;margin-top:8px;";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "CREATE";
    confirmBtn.style.cssText = `
      background:#172034;border:2px solid #22d3ee;color:#22d3ee;
      font-family:monospace;font-size:18px;padding:8px 20px;cursor:pointer;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "CANCEL";
    cancelBtn.style.cssText = `
      background:#172034;border:2px solid #6b7280;color:#6b7280;
      font-family:monospace;font-size:18px;padding:8px 20px;cursor:pointer;
    `;

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(title);
    box.appendChild(trackRow);
    box.appendChild(lapRow);
    box.appendChild(errorDiv);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.settingsDialog = overlay;

    confirmBtn.addEventListener("click", () => {
      const trackCount = parseInt(trackInput.value, 10);
      const laps = parseInt(lapInput.value, 10);
      if (isNaN(trackCount) || trackCount < 1 || trackCount > 4) {
        errorDiv.textContent = "Tracks must be 1–4.";
        return;
      }
      if (isNaN(laps) || laps < 1 || laps > 10) {
        errorDiv.textContent = "Laps must be 1–10.";
        return;
      }
      this.cleanupSettingsDialog();
      this.handleCreate({ trackCount, laps });
    });

    cancelBtn.addEventListener("click", () => this.cleanupSettingsDialog());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.cleanupSettingsDialog();
    });
  }

  private cleanupSettingsDialog(): void {
    if (this.settingsDialog) {
      this.settingsDialog.remove();
      this.settingsDialog = null;
    }
  }

  private handleCreate(settings: { trackCount: number; laps: number }): void {
    const nickname = getPlayerName() ?? "RACER";
    getSocket().emit("create_room", { nickname, settings }, (room) => {
      this.isHost = true;
      this.currentRoom = room;
      if (sessionState.online) {
        sessionState.online.roomId = room.id;
        sessionState.online.mySocketId = getSocket().id ?? null;
      }
      this.showLobby(room);
    });
  }
}
