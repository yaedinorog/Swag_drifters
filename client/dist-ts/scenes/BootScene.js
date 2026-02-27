import Phaser from "phaser";
import { injectTestTrack } from "../core/track/trackStore";
import { sessionState } from "../state/session";
export class BootScene extends Phaser.Scene {
    constructor() {
        super("boot");
    }
    preload() {
        this.load.image("car", `${import.meta.env.BASE_URL}car.png`);
    }
    create() {
        const tire = this.make.graphics({ x: 0, y: 0 }, false);
        tire.fillStyle(0x2d2d2d, 1);
        tire.fillRect(0, 0, 4, 4);
        tire.generateTexture("tire", 4, 4);
        tire.destroy();
        const testDriveData = sessionStorage.getItem("swag_test_drive");
        if (testDriveData) {
            try {
                const trackAsset = JSON.parse(testDriveData);
                sessionStorage.removeItem("swag_test_drive");
                injectTestTrack(trackAsset);
                sessionState.selectedTrackId = trackAsset.id;
                this.scene.start("race");
                return;
            }
            catch (err) {
                console.error("Failed to parse test drive track:", err);
            }
        }
        this.scene.start("menu");
    }
}
