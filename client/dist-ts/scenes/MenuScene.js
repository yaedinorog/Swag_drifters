import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../core/constants";
export class MenuScene extends Phaser.Scene {
    constructor() {
        super("menu");
    }
    create() {
        this.cameras.main.setBackgroundColor("#0c1018");
        this.add
            .text(GAME_WIDTH / 2, 190, "DRIFT LOOP MVP", {
            fontFamily: "monospace",
            fontSize: "56px",
            color: "#d0f0ff"
        })
            .setOrigin(0.5);
        this.add
            .text(GAME_WIDTH / 2, 300, "W/S or Up/Down: Throttle & Brake\nA/D or Left/Right: Steer\nSpace: Handbrake", {
            fontFamily: "monospace",
            fontSize: "24px",
            align: "center",
            color: "#f5f5f5"
        })
            .setOrigin(0.5);
        const button = this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, "[ LEVEL SELECT ]", {
            fontFamily: "monospace",
            fontSize: "36px",
            color: "#ffd166",
            backgroundColor: "#172034",
            padding: { left: 14, right: 14, top: 8, bottom: 8 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => this.scene.start("level_select"));
        const editorButton = this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 210, "[ TRACK EDITOR ]", {
            fontFamily: "monospace",
            fontSize: "28px",
            color: "#93c5fd",
            backgroundColor: "#172034",
            padding: { left: 12, right: 12, top: 6, bottom: 6 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        editorButton.on("pointerdown", () => {
            const base = import.meta.env.BASE_URL.endsWith("/")
                ? import.meta.env.BASE_URL
                : `${import.meta.env.BASE_URL}/`;
            window.location.href = `${base}editor`;
        });
        this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("level_select"));
        this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("level_select"));
    }
}
