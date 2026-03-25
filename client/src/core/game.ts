import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { LevelSelectScene } from "../scenes/LevelSelectScene";
import { RaceScene } from "../scenes/RaceScene";
import { ResultScene } from "../scenes/ResultScene";
import { PauseScene } from "../scenes/PauseScene";
import { OnlineLobbyScene } from "../scenes/OnlineLobbyScene";
import { OnlineResultScene } from "../scenes/OnlineResultScene";

export function createGame(container: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#0b1320",
    scene: [
      BootScene,
      MenuScene,
      LevelSelectScene,
      RaceScene,
      ResultScene,
      PauseScene,
      OnlineLobbyScene,
      OnlineResultScene
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: { default: "arcade" },
    render: { pixelArt: true }
  });
}
