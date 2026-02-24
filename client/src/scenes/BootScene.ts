import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("car", "/car.png");
  }

  create(): void {
    const tire = this.make.graphics({ x: 0, y: 0 }, false);
    tire.fillStyle(0x2d2d2d, 1);
    tire.fillRect(0, 0, 4, 4);
    tire.generateTexture("tire", 4, 4);
    tire.destroy();

    this.scene.start("menu");
  }
}
