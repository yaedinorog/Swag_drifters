export const track01 = {
    id: "track_01",
    outer: { x: 80, y: 60, width: 1120, height: 600 },
    inner: { x: 340, y: 210, width: 600, height: 300 },
    checkpoints: [
        { id: "start_finish", x: 632, y: 510, width: 16, height: 150 },
        { id: "cp_right", x: 940, y: 326, width: 260, height: 20 },
        { id: "cp_top", x: 632, y: 60, width: 16, height: 150 },
        { id: "cp_left", x: 80, y: 326, width: 260, height: 20 }
    ],
    spawn: {
        x: 700,
        y: 592,
        heading: 0
    }
};
export function isOnTrack(x, y, track) {
    const insideOuter = x >= track.outer.x &&
        x <= track.outer.x + track.outer.width &&
        y >= track.outer.y &&
        y <= track.outer.y + track.outer.height;
    const insideInner = x >= track.inner.x &&
        x <= track.inner.x + track.inner.width &&
        y >= track.inner.y &&
        y <= track.inner.y + track.inner.height;
    return insideOuter && !insideInner;
}
export function isInsideRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
