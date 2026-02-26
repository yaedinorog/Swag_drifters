import { buildTrackGeometry, isCenterlineClosed, isOnTrackFromGeometry } from "../core/track/geometry";
import { getTracks } from "../core/track/trackStore";
function cloneTrack(track) {
    return JSON.parse(JSON.stringify(track));
}
function makeDefaultTrack(id, name) {
    return {
        version: 1,
        id,
        name,
        centerline: [
            { x: 700, y: 590 },
            { x: 940, y: 520 },
            { x: 1080, y: 300 },
            { x: 940, y: 110 },
            { x: 340, y: 110 },
            { x: 200, y: 300 },
            { x: 340, y: 520 },
            { x: 700, y: 590 }
        ],
        roadWidth: 120,
        spawn: { x: 700, y: 590, heading: 0 },
        checkpoints: [
            { id: "start_finish", a: { x: 640, y: 650 }, b: { x: 640, y: 520 } },
            { id: "cp_01", a: { x: 960, y: 340 }, b: { x: 1160, y: 340 } }
        ],
        style: {
            grassColor: "#7adcb6",
            asphaltColor: "#2f3138",
            borderColor: "#d64545"
        }
    };
}
function downloadText(filename, content) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function distanceToSegment(point, a, b) {
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const abLenSq = abX * abX + abY * abY;
    if (abLenSq < 1e-6) {
        return distance(point, a);
    }
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * abX + (point.y - a.y) * abY) / abLenSq));
    const proj = { x: a.x + abX * t, y: a.y + abY * t };
    return distance(point, proj);
}
function normalizeBase(baseUrl) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
export function mountEditorApp(root) {
    const state = {
        tracks: getTracks().map((track) => cloneTrack(track.asset)),
        selectedTrackIndex: 0,
        selectedCenterPoint: null,
        selectedCheckpointIndex: 0,
        mode: "centerline",
        draggingCenterPoint: false,
        draggingCheckpointHandle: null,
        draggingCheckpointLine: false,
        checkpointLineDragOrigin: null,
        checkpointLineOriginal: null,
        draftCheckpointStart: null
    };
    root.innerHTML = `
    <div class="editor-shell">
      <aside class="editor-panel">
        <h1>Track Editor</h1>
        <p class="editor-help">Modes: centerline / spawn / checkpoint</p>

        <label>Track</label>
        <select id="trackSelect"></select>
        <div class="editor-actions-row">
          <button id="createTrack">Create</button>
          <button id="duplicateTrack">Duplicate</button>
        </div>

        <label>ID</label>
        <input id="trackId" type="text" />
        <label>Name</label>
        <input id="trackName" type="text" />
        <label>Road width</label>
        <input id="roadWidth" type="number" min="20" max="400" step="1" />

        <label>Mode</label>
        <select id="editMode">
          <option value="centerline">Centerline</option>
          <option value="spawn">Spawn</option>
          <option value="checkpoint">Checkpoint</option>
        </select>

        <div class="editor-actions-row">
          <button id="setClosed">Close centerline</button>
          <button id="deletePoint">Delete point</button>
        </div>

        <label>Spawn X</label>
        <input id="spawnX" type="number" />
        <label>Spawn Y</label>
        <input id="spawnY" type="number" />
        <label>Spawn heading</label>
        <input id="spawnHeading" type="number" step="0.01" />

        <label>Checkpoints</label>
        <select id="checkpointSelect"></select>
        <div class="editor-actions-row">
          <button id="addCheckpoint">Add CP</button>
          <button id="removeCheckpoint">Remove CP</button>
        </div>

        <div class="editor-actions-row">
          <button id="exportTrack">Export JSON</button>
          <button id="exportManifestPatch">Manifest patch</button>
        </div>
        <div class="editor-actions-row">
          <label class="editor-file-btn">Import JSON<input id="importTrack" type="file" accept="application/json" /></label>
        </div>

        <pre id="manifestPatch" class="editor-patch"></pre>
        <div id="validation" class="editor-validation"></div>
      </aside>
      <main class="editor-canvas-wrap">
        <canvas id="editorCanvas" width="1280" height="720"></canvas>
      </main>
    </div>
  `;
    const trackSelect = root.querySelector("#trackSelect");
    const trackId = root.querySelector("#trackId");
    const trackName = root.querySelector("#trackName");
    const roadWidth = root.querySelector("#roadWidth");
    const editMode = root.querySelector("#editMode");
    const spawnX = root.querySelector("#spawnX");
    const spawnY = root.querySelector("#spawnY");
    const spawnHeading = root.querySelector("#spawnHeading");
    const checkpointSelect = root.querySelector("#checkpointSelect");
    const validation = root.querySelector("#validation");
    const manifestPatch = root.querySelector("#manifestPatch");
    const canvas = root.querySelector("#editorCanvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("2D canvas context unavailable for editor.");
    }
    const currentTrack = () => state.tracks[state.selectedTrackIndex];
    const renderTrackSelect = () => {
        trackSelect.innerHTML = "";
        state.tracks.forEach((track, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = `${track.name} (${track.id})`;
            trackSelect.append(option);
        });
        trackSelect.value = String(state.selectedTrackIndex);
    };
    const renderCheckpointSelect = () => {
        const track = currentTrack();
        checkpointSelect.innerHTML = "";
        track.checkpoints.forEach((checkpoint, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = `${index + 1}. ${checkpoint.id}`;
            checkpointSelect.append(option);
        });
        state.selectedCheckpointIndex = Math.min(state.selectedCheckpointIndex, Math.max(track.checkpoints.length - 1, 0));
        checkpointSelect.value = String(state.selectedCheckpointIndex);
    };
    const refreshForm = () => {
        const track = currentTrack();
        trackId.value = track.id;
        trackName.value = track.name;
        roadWidth.value = String(track.roadWidth);
        editMode.value = state.mode;
        spawnX.value = track.spawn.x.toFixed(2);
        spawnY.value = track.spawn.y.toFixed(2);
        spawnHeading.value = track.spawn.heading.toFixed(3);
        renderTrackSelect();
        renderCheckpointSelect();
        renderValidation();
        draw();
    };
    const renderValidation = () => {
        const track = currentTrack();
        const errors = [];
        if (state.tracks.some((t, index) => index !== state.selectedTrackIndex && t.id === track.id)) {
            errors.push("Track id must be unique.");
        }
        if (track.centerline.length < 4) {
            errors.push("Centerline requires at least 4 points.");
        }
        if (!isCenterlineClosed(track.centerline)) {
            errors.push("Centerline must be closed (first point equals last point).");
        }
        if (track.checkpoints.length < 2) {
            errors.push("At least two checkpoints are required.");
        }
        if (track.checkpoints[0]?.id !== "start_finish") {
            errors.push("First checkpoint must be start_finish.");
        }
        let geometryError = null;
        try {
            const geometry = buildTrackGeometry(track);
            if (!isOnTrackFromGeometry(track.spawn.x, track.spawn.y, geometry)) {
                errors.push("Spawn must be on track.");
            }
        }
        catch (error) {
            geometryError = error instanceof Error ? error.message : "Invalid geometry";
        }
        if (geometryError) {
            errors.push(geometryError);
        }
        validation.innerHTML = errors.length
            ? `<strong>Validation errors</strong><ul>${errors.map((error) => `<li>${error}</li>`).join("")}</ul>`
            : "<strong>Validation</strong><div>OK</div>";
    };
    const draw = () => {
        const track = currentTrack();
        let displayCenterline = track.centerline;
        ctx.fillStyle = track.style.grassColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        try {
            const geometry = buildTrackGeometry(track);
            const borderGeometry = buildTrackGeometry({
                ...track,
                roadWidth: track.roadWidth + 20
            });
            displayCenterline = geometry.sampledCenterline;
            ctx.fillStyle = track.style.borderColor;
            borderGeometry.quads.forEach((quad) => {
                ctx.beginPath();
                ctx.moveTo(quad[0].x, quad[0].y);
                for (let i = 1; i < quad.length; i += 1) {
                    ctx.lineTo(quad[i].x, quad[i].y);
                }
                ctx.closePath();
                ctx.fill();
            });
            ctx.fillStyle = track.style.asphaltColor;
            geometry.quads.forEach((quad) => {
                ctx.beginPath();
                ctx.moveTo(quad[0].x, quad[0].y);
                for (let i = 1; i < quad.length; i += 1) {
                    ctx.lineTo(quad[i].x, quad[i].y);
                }
                ctx.closePath();
                ctx.fill();
            });
        }
        catch {
            // keep showing editing helpers even with invalid geometry
        }
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(displayCenterline[0].x, displayCenterline[0].y);
        displayCenterline.forEach((point, index) => {
            if (index > 0) {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
        track.centerline.forEach((point, index) => {
            ctx.fillStyle = state.selectedCenterPoint === index ? "#f59e0b" : "#ffffff";
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
        track.checkpoints.forEach((checkpoint, index) => {
            ctx.strokeStyle = index === 0 ? "#ffffff" : "#ffcc00";
            ctx.lineWidth = index === state.selectedCheckpointIndex ? 5 : 3;
            ctx.beginPath();
            ctx.moveTo(checkpoint.a.x, checkpoint.a.y);
            ctx.lineTo(checkpoint.b.x, checkpoint.b.y);
            ctx.stroke();
            ctx.fillStyle = "#111827";
            ctx.strokeStyle = "#fcd34d";
            ctx.lineWidth = 2;
            [checkpoint.a, checkpoint.b].forEach((point) => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        });
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 3;
        const headingLength = 45;
        const spawnEnd = {
            x: track.spawn.x + Math.cos(track.spawn.heading) * headingLength,
            y: track.spawn.y + Math.sin(track.spawn.heading) * headingLength
        };
        ctx.beginPath();
        ctx.moveTo(track.spawn.x, track.spawn.y);
        ctx.lineTo(spawnEnd.x, spawnEnd.y);
        ctx.stroke();
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(track.spawn.x, track.spawn.y, 7, 0, Math.PI * 2);
        ctx.fill();
        if (state.draftCheckpointStart) {
            ctx.strokeStyle = "#22d3ee";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(state.draftCheckpointStart.x, state.draftCheckpointStart.y, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    };
    const getCanvasPoint = (event) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    };
    const findNearestCenterPoint = (point, threshold = 12) => {
        let nearest = null;
        let nearestDistance = threshold;
        currentTrack().centerline.forEach((candidate, index) => {
            const d = distance(point, candidate);
            if (d <= nearestDistance) {
                nearest = index;
                nearestDistance = d;
            }
        });
        return nearest;
    };
    const findCheckpointHandle = (point, checkpoint, threshold = 12) => {
        if (distance(point, checkpoint.a) <= threshold) {
            return "a";
        }
        if (distance(point, checkpoint.b) <= threshold) {
            return "b";
        }
        return null;
    };
    canvas.addEventListener("mousedown", (event) => {
        const point = getCanvasPoint(event);
        const track = currentTrack();
        if (state.mode === "centerline") {
            const nearest = findNearestCenterPoint(point);
            state.selectedCenterPoint = nearest;
            state.draggingCenterPoint = nearest !== null;
            draw();
            return;
        }
        if (state.mode === "spawn") {
            track.spawn.x = point.x;
            track.spawn.y = point.y;
            refreshForm();
            return;
        }
        const checkpoint = track.checkpoints[state.selectedCheckpointIndex];
        const handle = findCheckpointHandle(point, checkpoint);
        if (handle) {
            state.draggingCheckpointHandle = handle;
            return;
        }
        if (distanceToSegment(point, checkpoint.a, checkpoint.b) <= 10) {
            state.draggingCheckpointLine = true;
            state.checkpointLineDragOrigin = point;
            state.checkpointLineOriginal = {
                a: { ...checkpoint.a },
                b: { ...checkpoint.b }
            };
            return;
        }
        if (!state.draftCheckpointStart) {
            state.draftCheckpointStart = point;
            draw();
            return;
        }
        const id = `cp_${String(track.checkpoints.length).padStart(2, "0")}`;
        track.checkpoints.push({
            id,
            a: { ...state.draftCheckpointStart },
            b: point
        });
        state.draftCheckpointStart = null;
        state.selectedCheckpointIndex = track.checkpoints.length - 1;
        refreshForm();
    });
    canvas.addEventListener("mousemove", (event) => {
        const point = getCanvasPoint(event);
        const track = currentTrack();
        if (state.mode === "centerline" && state.draggingCenterPoint && state.selectedCenterPoint !== null) {
            track.centerline[state.selectedCenterPoint] = point;
            refreshForm();
            return;
        }
        if (state.mode === "checkpoint" && state.draggingCheckpointHandle) {
            const checkpoint = track.checkpoints[state.selectedCheckpointIndex];
            checkpoint[state.draggingCheckpointHandle] = point;
            refreshForm();
            return;
        }
        if (state.mode === "checkpoint" && state.draggingCheckpointLine && state.checkpointLineDragOrigin && state.checkpointLineOriginal) {
            const checkpoint = track.checkpoints[state.selectedCheckpointIndex];
            const dx = point.x - state.checkpointLineDragOrigin.x;
            const dy = point.y - state.checkpointLineDragOrigin.y;
            checkpoint.a = {
                x: state.checkpointLineOriginal.a.x + dx,
                y: state.checkpointLineOriginal.a.y + dy
            };
            checkpoint.b = {
                x: state.checkpointLineOriginal.b.x + dx,
                y: state.checkpointLineOriginal.b.y + dy
            };
            refreshForm();
        }
    });
    canvas.addEventListener("mouseup", () => {
        state.draggingCenterPoint = false;
        state.draggingCheckpointHandle = null;
        state.draggingCheckpointLine = false;
        state.checkpointLineDragOrigin = null;
        state.checkpointLineOriginal = null;
    });
    canvas.addEventListener("dblclick", (event) => {
        if (state.mode !== "centerline") {
            return;
        }
        const point = getCanvasPoint(event);
        const track = currentTrack();
        track.centerline.splice(track.centerline.length - 1, 0, point);
        state.selectedCenterPoint = track.centerline.length - 2;
        refreshForm();
    });
    trackSelect.addEventListener("change", () => {
        state.selectedTrackIndex = Number(trackSelect.value);
        state.selectedCenterPoint = null;
        state.selectedCheckpointIndex = 0;
        refreshForm();
    });
    editMode.addEventListener("change", () => {
        state.mode = editMode.value;
        state.draftCheckpointStart = null;
        state.draggingCheckpointLine = false;
        state.checkpointLineDragOrigin = null;
        state.checkpointLineOriginal = null;
        refreshForm();
    });
    trackId.addEventListener("input", () => {
        currentTrack().id = trackId.value.trim();
        refreshForm();
    });
    trackName.addEventListener("input", () => {
        currentTrack().name = trackName.value;
        refreshForm();
    });
    roadWidth.addEventListener("input", () => {
        currentTrack().roadWidth = Math.max(20, Number(roadWidth.value) || 20);
        refreshForm();
    });
    spawnX.addEventListener("input", () => {
        currentTrack().spawn.x = Number(spawnX.value) || 0;
        refreshForm();
    });
    spawnY.addEventListener("input", () => {
        currentTrack().spawn.y = Number(spawnY.value) || 0;
        refreshForm();
    });
    spawnHeading.addEventListener("input", () => {
        currentTrack().spawn.heading = Number(spawnHeading.value) || 0;
        refreshForm();
    });
    checkpointSelect.addEventListener("change", () => {
        state.selectedCheckpointIndex = Number(checkpointSelect.value);
        draw();
    });
    root.querySelector("#createTrack")?.addEventListener("click", () => {
        const nextIndex = state.tracks.length + 1;
        state.tracks.push(makeDefaultTrack(`track_${String(nextIndex).padStart(2, "0")}`, `Track ${nextIndex}`));
        state.selectedTrackIndex = state.tracks.length - 1;
        state.selectedCenterPoint = null;
        state.selectedCheckpointIndex = 0;
        refreshForm();
    });
    root.querySelector("#duplicateTrack")?.addEventListener("click", () => {
        const source = cloneTrack(currentTrack());
        source.id = `${source.id}_copy`;
        source.name = `${source.name} Copy`;
        state.tracks.push(source);
        state.selectedTrackIndex = state.tracks.length - 1;
        refreshForm();
    });
    root.querySelector("#setClosed")?.addEventListener("click", () => {
        const track = currentTrack();
        if (track.centerline.length > 2) {
            const first = track.centerline[0];
            track.centerline[track.centerline.length - 1] = { ...first };
            refreshForm();
        }
    });
    root.querySelector("#deletePoint")?.addEventListener("click", () => {
        const track = currentTrack();
        if (state.selectedCenterPoint === null || track.centerline.length <= 4) {
            return;
        }
        if (state.selectedCenterPoint === 0 || state.selectedCenterPoint === track.centerline.length - 1) {
            return;
        }
        track.centerline.splice(state.selectedCenterPoint, 1);
        state.selectedCenterPoint = null;
        refreshForm();
    });
    root.querySelector("#addCheckpoint")?.addEventListener("click", () => {
        const track = currentTrack();
        track.checkpoints.push({
            id: `cp_${String(track.checkpoints.length).padStart(2, "0")}`,
            a: { x: 620, y: 360 },
            b: { x: 760, y: 360 }
        });
        state.selectedCheckpointIndex = track.checkpoints.length - 1;
        refreshForm();
    });
    root.querySelector("#removeCheckpoint")?.addEventListener("click", () => {
        const track = currentTrack();
        if (track.checkpoints.length <= 2 || state.selectedCheckpointIndex === 0) {
            return;
        }
        track.checkpoints.splice(state.selectedCheckpointIndex, 1);
        state.selectedCheckpointIndex = Math.max(0, state.selectedCheckpointIndex - 1);
        refreshForm();
    });
    root.querySelector("#exportTrack")?.addEventListener("click", () => {
        const track = currentTrack();
        downloadText(`${track.id}.json`, `${JSON.stringify(track, null, 2)}\n`);
    });
    root.querySelector("#exportManifestPatch")?.addEventListener("click", () => {
        const track = currentTrack();
        const patch = {
            id: track.id,
            name: track.name,
            file: `${track.id}.json`
        };
        manifestPatch.textContent = JSON.stringify(patch, null, 2);
    });
    root.querySelector("#importTrack")?.addEventListener("change", async (event) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        const text = await file.text();
        const parsed = JSON.parse(text);
        state.tracks.push(parsed);
        state.selectedTrackIndex = state.tracks.length - 1;
        state.selectedCheckpointIndex = 0;
        refreshForm();
        input.value = "";
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Delete" && state.mode === "centerline") {
            root.querySelector("#deletePoint")?.click();
        }
    });
    const base = normalizeBase(import.meta.env.BASE_URL);
    const backLink = document.createElement("a");
    backLink.href = `${base}`;
    backLink.textContent = "Back to game";
    backLink.className = "editor-back-link";
    root.querySelector(".editor-panel")?.prepend(backLink);
    refreshForm();
}
