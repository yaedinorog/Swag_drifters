import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
import { connectSocket } from "../services/socket";
import { getPlayerName, setPlayerName } from "../state/playerProfile";
import { sessionState } from "../state/session";

const NAME_PATTERN = /^[A-Za-z0-9_ ]{3,16}$/;

export class MenuScene extends Phaser.Scene {
  private levelSelectButton?: Phaser.GameObjects.Text;
  private onlineButton?: Phaser.GameObjects.Text;
  private editorButton?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private nameDialog: HTMLDivElement | null = null;

  constructor() {
    super("menu");
  }

  create(): void {
    this.input.enabled = true;
    this.cameras.main.setBackgroundColor("#0c1018");
    this.add
      .text(GAME_WIDTH / 2, 190, "DRIFT LOOP MVP", {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#d0f0ff"
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        290,
        [
          "W / S   Throttle & Brake",
          "A / D   Steer",
          "SPACE   Handbrake",
          "SHIFT   Turbo boost",
          "",
          "Drift fills the turbo bar"
        ].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "18px",
          align: "center",
          color: "#c8d8e8",
          lineSpacing: 6
        }
      )
      .setOrigin(0.5);

    this.levelSelectButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, "[ OFFLINE MODE ]", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ffd166",
        backgroundColor: "#172034",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.levelSelectButton.on("pointerdown", this.handleLevelSelect, this);

    this.onlineButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 170, "[ ONLINE MODE ]", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#22d3ee",
        backgroundColor: "#172034",
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.onlineButton.on("pointerdown", this.handleOnlineMode, this);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 240, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f87171"
      })
      .setOrigin(0.5);

    this.editorButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 300, "[ TRACK EDITOR ]", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#93c5fd",
        backgroundColor: "#172034",
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.editorButton.on("pointerdown", this.handleOpenEditor, this);

    this.input.keyboard?.on("keydown-SPACE", this.handleLevelSelect, this);
    this.input.keyboard?.on("keydown-ENTER", this.handleLevelSelect, this);

    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-SPACE", this.handleLevelSelect, this);
      this.input.keyboard?.off("keydown-ENTER", this.handleLevelSelect, this);
      this.cleanupDialog();
    });
  }

  shutdown(): void {
    this.cleanupDialog();
  }

  private handleLevelSelect(): void {
    this.scene.start("level_select");
  }

  private async handleOnlineMode(): Promise<void> {
    if (!this.onlineButton) return;
    this.onlineButton.setText("Connecting...");
    this.onlineButton.disableInteractive();
    this.statusText?.setText("");

    try {
      const socket = await connectSocket();
      sessionState.online = {
        active: false,
        roomId: null,
        mySocketId: socket.id ?? null,
        players: [],
        trackList: [],
        currentTrackIndex: 0,
        laps: 3,
        sessionScores: {},
        lastTrackResults: []
      };

      const name = getPlayerName();
      if (!name) {
        this.openNameDialog(() => {
          this.scene.start("online_lobby");
        });
      } else {
        this.scene.start("online_lobby");
      }
    } catch {
      this.statusText?.setText("Server unavailable. Try again.");
      this.onlineButton.setText("[ ONLINE MODE ]");
      this.onlineButton.setInteractive({ useHandCursor: true });
    }
  }

  private openNameDialog(onConfirm: () => void): void {
    if (this.nameDialog) return;

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
      font-family:monospace;color:#f8fafc;text-align:center;
      min-width:360px;
    `;

    const label = document.createElement("div");
    label.textContent = "Enter your nickname (3–16 chars)";
    label.style.cssText = "font-size:18px;margin-bottom:16px;color:#22d3ee;";

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = "RACER";
    input.style.cssText = `
      background:#0b1222;border:1px solid #4b5563;color:#f8fafc;
      font-family:monospace;font-size:22px;padding:8px 12px;
      width:100%;box-sizing:border-box;outline:none;text-align:center;
      margin-bottom:12px;
    `;

    const error = document.createElement("div");
    error.style.cssText =
      "font-size:14px;color:#f87171;min-height:18px;margin-bottom:8px;";

    const hint = document.createElement("div");
    hint.textContent = "Enter to confirm   Esc to cancel";
    hint.style.cssText = "font-size:14px;color:#6b7280;";

    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(error);
    box.appendChild(hint);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.nameDialog = overlay;

    setTimeout(() => input.focus(), 50);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const name = input.value.trim();
        if (!NAME_PATTERN.test(name)) {
          error.textContent =
            "Invalid name. Use 3-16 chars: letters, digits, _ or space.";
          return;
        }
        setPlayerName(name);
        this.cleanupDialog();
        onConfirm();
      } else if (e.key === "Escape") {
        this.cleanupDialog();
        this.onlineButton?.setText("[ ONLINE MODE ]");
        this.onlineButton?.setInteractive({ useHandCursor: true });
      }
      e.stopPropagation();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.cleanupDialog();
        this.onlineButton?.setText("[ ONLINE MODE ]");
        this.onlineButton?.setInteractive({ useHandCursor: true });
      }
    });
  }

  private cleanupDialog(): void {
    if (this.nameDialog) {
      this.nameDialog.remove();
      this.nameDialog = null;
    }
  }

  private handleOpenEditor(): void {
    const base = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    window.location.href = `${base}editor`;
  }
}


