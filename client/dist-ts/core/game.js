import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { RaceScene } from "../scenes/RaceScene";
import { ResultScene } from "../scenes/ResultScene";
export function createGame(container) {
    return new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: "#0b1320",
        scene: [BootScene, MenuScene, RaceScene, ResultScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: { default: "arcade" },
        render: { pixelArt: true }
    });
}
