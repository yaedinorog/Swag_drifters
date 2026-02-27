import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { LevelSelectScene } from "../scenes/LevelSelectScene";
import { RaceScene } from "../scenes/RaceScene";
import { ResultScene } from "../scenes/ResultScene";
import { PauseScene } from "../scenes/PauseScene";
export function createGame(container) {
    return new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: "#0b1320",
        scene: [BootScene, MenuScene, LevelSelectScene, RaceScene, ResultScene, PauseScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: { default: "arcade" },
        render: { pixelArt: true }
    });
}
