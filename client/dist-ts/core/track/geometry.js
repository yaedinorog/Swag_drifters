function normalize(x, y) {
    const len = Math.hypot(x, y);
    if (len < 1e-6) {
        return { x: 0, y: 0 };
    }
    return { x: x / len, y: y / len };
}
function almostEqual(a, b) {
    return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
}
function getClosedCenterline(points) {
    if (points.length < 3) {
        throw new Error("Track centerline must contain at least 3 points.");
    }
    const clean = [...points];
    if (almostEqual(clean[0], clean[clean.length - 1])) {
        clean.pop();
    }
    return clean;
}
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects = yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
}
function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
        x: 0.5 *
            ((2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 *
            ((2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
}
function sampleClosedSpline(points) {
    const n = points.length;
    const sampled = [];
    for (let i = 0; i < n; i += 1) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];
        const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const subdivisions = Math.max(6, Math.min(28, Math.ceil(segmentLength / 26)));
        for (let j = 0; j < subdivisions; j += 1) {
            const t = j / subdivisions;
            sampled.push(catmullRom(p0, p1, p2, p3, t));
        }
    }
    return sampled;
}
function getAveragedNormal(points, index) {
    const n = points.length;
    const prev = points[(index - 1 + n) % n];
    const curr = points[index];
    const next = points[(index + 1) % n];
    const d1 = normalize(curr.x - prev.x, curr.y - prev.y);
    const d2 = normalize(next.x - curr.x, next.y - curr.y);
    const n1 = { x: -d1.y, y: d1.x };
    const n2 = { x: -d2.y, y: d2.x };
    const avg = normalize(n1.x + n2.x, n1.y + n2.y);
    if (Math.abs(avg.x) < 1e-6 && Math.abs(avg.y) < 1e-6) {
        return n2;
    }
    return avg;
}
export function buildTrackGeometry(asset) {
    const baseCenterline = getClosedCenterline(asset.centerline);
    const centerline = sampleClosedSpline(baseCenterline);
    const halfWidth = asset.roadWidth / 2;
    const leftEdge = [];
    const rightEdge = [];
    for (let i = 0; i < centerline.length; i += 1) {
        const p = centerline[i];
        const normal = getAveragedNormal(centerline, i);
        leftEdge.push({ x: p.x + normal.x * halfWidth, y: p.y + normal.y * halfWidth });
        rightEdge.push({ x: p.x - normal.x * halfWidth, y: p.y - normal.y * halfWidth });
    }
    const quads = [];
    for (let i = 0; i < centerline.length; i += 1) {
        const next = (i + 1) % centerline.length;
        quads.push([leftEdge[i], rightEdge[i], rightEdge[next], leftEdge[next]]);
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    leftEdge.concat(rightEdge).forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    return {
        sampledCenterline: centerline,
        quads,
        leftEdge,
        rightEdge,
        bounds: { minX, minY, maxX, maxY }
    };
}
export function isOnTrackFromGeometry(x, y, geometry) {
    if (x < geometry.bounds.minX ||
        x > geometry.bounds.maxX ||
        y < geometry.bounds.minY ||
        y > geometry.bounds.maxY) {
        return false;
    }
    for (const quad of geometry.quads) {
        if (pointInPolygon({ x, y }, quad)) {
            return true;
        }
    }
    return false;
}
function orientation(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}
function onSegment(a, b, c) {
    return (Math.min(a.x, c.x) - 1e-6 <= b.x &&
        b.x <= Math.max(a.x, c.x) + 1e-6 &&
        Math.min(a.y, c.y) - 1e-6 <= b.y &&
        b.y <= Math.max(a.y, c.y) + 1e-6);
}
export function segmentsIntersect(a1, a2, b1, b2) {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);
    if (o1 * o2 < 0 && o3 * o4 < 0) {
        return true;
    }
    if (Math.abs(o1) < 1e-6 && onSegment(a1, b1, a2)) {
        return true;
    }
    if (Math.abs(o2) < 1e-6 && onSegment(a1, b2, a2)) {
        return true;
    }
    if (Math.abs(o3) < 1e-6 && onSegment(b1, a1, b2)) {
        return true;
    }
    if (Math.abs(o4) < 1e-6 && onSegment(b1, a2, b2)) {
        return true;
    }
    return false;
}
export function isCenterlineClosed(points) {
    if (points.length < 3) {
        return false;
    }
    return almostEqual(points[0], points[points.length - 1]);
}
