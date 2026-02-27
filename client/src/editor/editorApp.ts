import { buildTrackGeometry, isCenterlineClosed, isOnTrackFromGeometry } from "../core/track/geometry";
import { getTracks, saveCustomTracks } from "../core/track/trackStore";
import type { TrackAssetV1, TrackCheckpoint } from "../core/track/types";
import type { Vector2 } from "../core/types";

type EditorMode = "centerline" | "spawn" | "checkpoint";

interface EditorState {
  tracks: TrackAssetV1[];
  selectedTrackIndex: number;
  selectedCenterPoint: number | null;
  selectedCheckpointIndex: number;
  mode: EditorMode;
  draggingCenterPoint: boolean;
  draggingCheckpointHandle: "a" | "b" | null;
  draggingCheckpointLine: boolean;
  checkpointLineDragOrigin: Vector2 | null;
  checkpointLineOriginal: { a: Vector2; b: Vector2 } | null;
  draftCheckpointStart: Vector2 | null;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  isPanning: boolean;
  lastPanPoint: Vector2 | null;
}

function cloneTrack(track: TrackAssetV1): TrackAssetV1 {
  return JSON.parse(JSON.stringify(track)) as TrackAssetV1;
}

function makeDefaultTrack(id: string, name: string): TrackAssetV1 {
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

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Vector2, a: Vector2, b: Vector2): number {
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

function normalizeBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function mountEditorApp(root: HTMLElement): void {
  const baseTrackIds = new Set(getTracks().map((track) => track.asset.id));
  const customTrackIds = new Set<string>();
  const state: EditorState = {
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
    draftCheckpointStart: null,
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1.0,
    isPanning: false,
    lastPanPoint: null
  };
  let saveTimer: number | null = null;
  const updateCustomTrackIds = (): void => {
    state.tracks.forEach((track) => {
      if (!baseTrackIds.has(track.id)) {
        customTrackIds.add(track.id);
      }
    });
  };

  const scheduleSave = (): void => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      updateCustomTrackIds();
      const customTracks = state.tracks.filter((track) => customTrackIds.has(track.id));
      saveCustomTracks(customTracks);
      saveTimer = null;
    }, 300);
  };

  const storedTestDriveBackup = sessionStorage.getItem("swag_test_drive_backup");
  if (storedTestDriveBackup) {
    try {
      const parsed = JSON.parse(storedTestDriveBackup) as TrackAssetV1;
      const idx = state.tracks.findIndex((t) => t.id === parsed.id);
      if (idx !== -1) {
        state.tracks[idx] = parsed;
        state.selectedTrackIndex = idx;
      } else {
        state.tracks.push(parsed);
        state.selectedTrackIndex = state.tracks.length - 1;
      }
    } catch (e) {
      console.error("Failed to restore editor backup", e);
    }
    sessionStorage.removeItem("swag_test_drive_backup");
  }

  root.innerHTML = `
    <div class="editor-shell">
      <aside class="editor-panel">
        <h1>Track Editor</h1>
        <p class="editor-help">Modes: centerline / spawn / checkpoint</p>

        <div class="editor-section">
          <h2 class="editor-section-title">Track Management</h2>
          <label>Track</label>
          <select id="trackSelect"></select>
          <div class="editor-actions-row">
            <button id="createTrack">Create</button>
            <button id="duplicateTrack">Duplicate</button>
          </div>
          <div class="editor-actions-row">
            <button id="testDriveTrack" style="background-color: #2563eb; color: #fff; font-weight: bold; width: 100%; margin-bottom: 0.5rem; border: none;">▶ Test Drive</button>
          </div>
        </div>

        <div class="editor-section">
          <h2 class="editor-section-title">Properties</h2>
          <label>ID</label>
          <input id="trackId" type="text" />
          <label>Name</label>
          <input id="trackName" type="text" />
          <label>Road width</label>
          <input id="roadWidth" type="number" min="20" max="400" step="1" />
        </div>

        <div class="editor-section">
          <h2 class="editor-section-title">Tools</h2>
          <label>Mode</label>
          <select id="editMode">
            <option value="centerline">Centerline</option>
            <option value="spawn">Spawn</option>
            <option value="checkpoint">Checkpoints</option>
          </select>

          <div class="editor-actions-row">
            <button id="actionAdd">Add</button>
            <button id="actionDelete">Delete</button>
            <button id="actionCloseTrack">Close Track</button>
          </div>
          <div id="spawnHeadingContainer" style="margin-top: 0.5rem; display: none;">
            <label>Spawn heading</label>
            <input id="spawnHeading" type="number" step="0.01" />
          </div>
        </div>

        <div class="editor-section">
          <h2 class="editor-section-title">Data</h2>
          <div class="editor-actions-row">
            <button id="exportTrack">Export JSON</button>
            <button id="exportManifestPatch">Manifest patch</button>
          </div>
          <div class="editor-actions-row">
            <label class="editor-file-btn" style="width: 100%; text-align: center;">Import JSON<input id="importTrack" type="file" accept="application/json" /></label>
          </div>
        </div>

        <pre id="manifestPatch" class="editor-patch"></pre>
        <div id="validation" class="editor-validation"></div>
      </aside>
      <main class="editor-canvas-wrap">
        <canvas id="editorCanvas" width="1280" height="720"></canvas>
      </main>
    </div>
  `;

  const trackSelect = root.querySelector<HTMLSelectElement>("#trackSelect")!;
  const trackId = root.querySelector<HTMLInputElement>("#trackId")!;
  const trackName = root.querySelector<HTMLInputElement>("#trackName")!;
  const roadWidth = root.querySelector<HTMLInputElement>("#roadWidth")!;
  const editMode = root.querySelector<HTMLSelectElement>("#editMode")!;
  const spawnHeading = root.querySelector<HTMLInputElement>("#spawnHeading")!;
  const spawnHeadingContainer = root.querySelector<HTMLDivElement>("#spawnHeadingContainer")!;
  const validation = root.querySelector<HTMLDivElement>("#validation")!;
  const manifestPatch = root.querySelector<HTMLPreElement>("#manifestPatch")!;
  const canvas = root.querySelector<HTMLCanvasElement>("#editorCanvas")!;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("2D canvas context unavailable for editor.");
  }

  const currentTrack = (): TrackAssetV1 => state.tracks[state.selectedTrackIndex];

  const renderTrackSelect = (): void => {
    trackSelect.innerHTML = "";
    state.tracks.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${track.name} (${track.id})`;
      trackSelect.append(option);
    });
    trackSelect.value = String(state.selectedTrackIndex);
  };

  const refreshForm = (): void => {
    const track = currentTrack();
    trackId.value = track.id;
    trackName.value = track.name;
    roadWidth.value = String(track.roadWidth);
    editMode.value = state.mode;
    spawnHeading.value = track.spawn.heading.toFixed(3);
    spawnHeadingContainer.style.display = state.mode === "spawn" ? "block" : "none";
    renderTrackSelect();
    renderValidation();
    draw();
    updateCustomTrackIds();
    scheduleSave();
  };

  const renderValidation = (): void => {
    const track = currentTrack();
    const errors: string[] = [];
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

    let geometryError: string | null = null;
    try {
      const geometry = buildTrackGeometry(track);
      if (!isOnTrackFromGeometry(track.spawn.x, track.spawn.y, geometry)) {
        errors.push("Spawn must be on track.");
      }
    } catch (error) {
      geometryError = error instanceof Error ? error.message : "Invalid geometry";
    }
    if (geometryError) {
      errors.push(geometryError);
    }

    validation.innerHTML = errors.length
      ? `<strong>Validation errors</strong><ul>${errors.map((error) => `<li>${error}</li>`).join("")}</ul>`
      : "<strong>Validation</strong><div>OK</div>";
  };

  const draw = (): void => {
    const track = currentTrack();
    let displayCenterline = track.centerline;
    ctx.fillStyle = track.style.grassColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-state.cameraX, -state.cameraY);
    ctx.scale(state.cameraZoom, state.cameraZoom);

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
    } catch {
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
      const isSelected = state.selectedCenterPoint === index && state.mode === "centerline";
      ctx.fillStyle = state.mode === "centerline"
        ? (isSelected ? "#f59e0b" : "#ffffff")
        : "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    track.checkpoints.forEach((checkpoint, index) => {
      const isSelected = index === state.selectedCheckpointIndex && state.mode === "checkpoint";
      ctx.strokeStyle = state.mode === "checkpoint"
        ? (index === 0 ? "#ffffff" : "#ffcc00")
        : "rgba(255, 204, 0, 0.3)";
      if (index === 0 && state.mode !== "checkpoint") ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";

      ctx.lineWidth = isSelected ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(checkpoint.a.x, checkpoint.a.y);
      ctx.lineTo(checkpoint.b.x, checkpoint.b.y);
      ctx.stroke();

      ctx.fillStyle = state.mode === "checkpoint" ? "#111827" : "rgba(17, 24, 39, 0.3)";
      ctx.strokeStyle = state.mode === "checkpoint" ? "#fcd34d" : "rgba(252, 211, 77, 0.3)";
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

    ctx.restore();
  };

  const getCanvasPoint = (event: MouseEvent): Vector2 => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const basePxX = (event.clientX - rect.left) * scaleX;
    const basePxY = (event.clientY - rect.top) * scaleY;

    return {
      x: (basePxX + state.cameraX) / state.cameraZoom,
      y: (basePxY + state.cameraY) / state.cameraZoom
    };
  };

  const findNearestCenterPoint = (point: Vector2, threshold = 12): number | null => {
    let nearest: number | null = null;
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

  const findCheckpointHandle = (point: Vector2, checkpoint: TrackCheckpoint, threshold = 12): "a" | "b" | null => {
    if (distance(point, checkpoint.a) <= threshold) {
      return "a";
    }
    if (distance(point, checkpoint.b) <= threshold) {
      return "b";
    }
    return null;
  };

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 1 || event.button === 2) {
      // Middle or right click for panning
      state.isPanning = true;
      state.lastPanPoint = { x: event.clientX, y: event.clientY };
      return;
    }

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

    if (state.mode === "checkpoint") {
      let clickedCheckpointIndex: number | null = null;
      let clickedHandle: "a" | "b" | null = null;
      let clickedLine = false;

      for (let i = track.checkpoints.length - 1; i >= 0; i--) {
        const cp = track.checkpoints[i];
        const handle = findCheckpointHandle(point, cp);
        if (handle) {
          clickedCheckpointIndex = i;
          clickedHandle = handle;
          break;
        }
        if (distanceToSegment(point, cp.a, cp.b) <= 10) {
          clickedCheckpointIndex = i;
          clickedLine = true;
          break;
        }
      }

      if (clickedCheckpointIndex !== null) {
        state.selectedCheckpointIndex = clickedCheckpointIndex;
        if (clickedHandle) {
          state.draggingCheckpointHandle = clickedHandle;
        } else if (clickedLine) {
          state.draggingCheckpointLine = true;
          state.checkpointLineDragOrigin = point;
          state.checkpointLineOriginal = {
            a: { ...track.checkpoints[clickedCheckpointIndex].a },
            b: { ...track.checkpoints[clickedCheckpointIndex].b }
          };
        }
        refreshForm();
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
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (state.isPanning && state.lastPanPoint) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const dx = (event.clientX - state.lastPanPoint.x) * scaleX;
      const dy = (event.clientY - state.lastPanPoint.y) * scaleY;
      state.cameraX -= dx;
      state.cameraY -= dy;
      state.lastPanPoint = { x: event.clientX, y: event.clientY };
      draw();
      return;
    }

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
    state.isPanning = false;
    state.lastPanPoint = null;
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

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(0.1, state.cameraZoom * zoomDelta), 5.0);

    // Zoom around mouse
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const basePxX = (event.clientX - rect.left) * scaleX;
    const basePxY = (event.clientY - rect.top) * scaleY;

    // Calculate position in world space before zoom
    const worldX = (basePxX + state.cameraX) / state.cameraZoom;
    const worldY = (basePxY + state.cameraY) / state.cameraZoom;

    state.cameraZoom = newZoom;

    // Keep world coordinate pinned
    state.cameraX = worldX * state.cameraZoom - basePxX;
    state.cameraY = worldY * state.cameraZoom - basePxY;

    draw();
  });

  trackSelect.addEventListener("change", () => {
    state.selectedTrackIndex = Number(trackSelect.value);
    state.selectedCenterPoint = null;
    state.selectedCheckpointIndex = 0;
    refreshForm();
  });

  editMode.addEventListener("change", () => {
    state.mode = editMode.value as EditorMode;
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

  spawnHeading.addEventListener("input", () => {
    currentTrack().spawn.heading = Number(spawnHeading.value) || 0;
    refreshForm();
  });

  root.querySelector<HTMLButtonElement>("#createTrack")?.addEventListener("click", () => {
    const nextIndex = state.tracks.length + 1;
    const newTrack = makeDefaultTrack(`track_${String(nextIndex).padStart(2, "0")}`, `Track ${nextIndex}`);
    state.tracks.push(newTrack);
    customTrackIds.add(newTrack.id);
    state.selectedTrackIndex = state.tracks.length - 1;
    state.selectedCenterPoint = null;
    state.selectedCheckpointIndex = 0;
    refreshForm();
  });

  root.querySelector<HTMLButtonElement>("#duplicateTrack")?.addEventListener("click", () => {
    const source = cloneTrack(currentTrack());
    source.id = `${source.id}_copy`;
    source.name = `${source.name} Copy`;
    state.tracks.push(source);
    customTrackIds.add(source.id);
    state.selectedTrackIndex = state.tracks.length - 1;
    refreshForm();
  });

  root.querySelector<HTMLButtonElement>("#actionCloseTrack")?.addEventListener("click", () => {
    const track = currentTrack();
    if (track.centerline.length > 2) {
      const first = track.centerline[0];
      track.centerline[track.centerline.length - 1] = { ...first };
      refreshForm();
    }
  });

  root.querySelector<HTMLButtonElement>("#actionDelete")?.addEventListener("click", () => {
    const track = currentTrack();
    if (state.mode === "centerline") {
      if (state.selectedCenterPoint === null || track.centerline.length <= 4) return;
      if (state.selectedCenterPoint === 0 || state.selectedCenterPoint === track.centerline.length - 1) return;
      track.centerline.splice(state.selectedCenterPoint, 1);
      state.selectedCenterPoint = null;
    } else if (state.mode === "checkpoint") {
      if (track.checkpoints.length <= 2 || state.selectedCheckpointIndex === 0) return;
      track.checkpoints.splice(state.selectedCheckpointIndex, 1);
      state.selectedCheckpointIndex = Math.max(0, state.selectedCheckpointIndex - 1);
    }
    refreshForm();
  });

  root.querySelector<HTMLButtonElement>("#actionAdd")?.addEventListener("click", () => {
    const track = currentTrack();
    if (state.mode === "centerline") {
      const idx = state.selectedCenterPoint !== null ? state.selectedCenterPoint : track.centerline.length - 2;
      const p1 = track.centerline[idx];
      const p2 = track.centerline[idx + 1] || track.centerline[0];
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      track.centerline.splice(idx + 1, 0, mid);
      state.selectedCenterPoint = idx + 1;
    } else if (state.mode === "checkpoint") {
      track.checkpoints.push({
        id: `cp_${String(track.checkpoints.length).padStart(2, "0")}`,
        a: { x: track.spawn.x - 50, y: track.spawn.y },
        b: { x: track.spawn.x + 50, y: track.spawn.y }
      });
      state.selectedCheckpointIndex = track.checkpoints.length - 1;
    }
    refreshForm();
  });

  root.querySelector<HTMLButtonElement>("#exportTrack")?.addEventListener("click", () => {
    const track = currentTrack();
    downloadText(`${track.id}.json`, `${JSON.stringify(track, null, 2)}\n`);
  });

  root.querySelector<HTMLButtonElement>("#exportManifestPatch")?.addEventListener("click", () => {
    const track = currentTrack();
    const patch = {
      id: track.id,
      name: track.name,
      file: `${track.id}.json`
    };
    manifestPatch.textContent = JSON.stringify(patch, null, 2);
  });

  root.querySelector<HTMLButtonElement>("#testDriveTrack")?.addEventListener("click", () => {
    const track = currentTrack();
    const trackJson = JSON.stringify(track);
    sessionStorage.setItem("swag_test_drive", trackJson);
    sessionStorage.setItem("swag_test_drive_backup", trackJson);
    window.location.href = normalizeBase(import.meta.env.BASE_URL);
  });

  root.querySelector<HTMLInputElement>("#importTrack")?.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const parsed = JSON.parse(text) as TrackAssetV1;
    state.tracks.push(parsed);
    customTrackIds.add(parsed.id);
    state.selectedTrackIndex = state.tracks.length - 1;
    state.selectedCheckpointIndex = 0;
    refreshForm();
    input.value = "";
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Delete") {
      root.querySelector<HTMLButtonElement>("#actionDelete")?.click();
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
