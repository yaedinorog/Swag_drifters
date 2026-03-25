export interface RoomSettings {
  trackCount: number;
  laps: number;
}

export interface RoomSummary {
  id: string;
  hostNickname: string;
  playerCount: number;
  status: string;
}

export interface RoomSnapshot extends RoomSummary {
  players: { socketId: string; nickname: string }[];
  settings: RoomSettings;
}

export interface TrackResult {
  socketId: string;
  nickname: string;
  timeMs: number | null;
  skillRate: number;
}

export interface PodiumEntry {
  socketId: string;
  nickname: string;
  totalScore: number;
}

export interface ServerToClientEvents {
  rooms_list: (rooms: RoomSummary[]) => void;
  player_joined: (player: { socketId: string; nickname: string }) => void;
  player_left: (info: { socketId: string; newHostId?: string }) => void;
  game_starting: (data: { trackList: string[]; settings: RoomSettings }) => void;
  countdown_start: () => void;
  race_go: () => void;
  player_moved: (data: {
    socketId: string;
    x: number;
    y: number;
    rotation: number;
  }) => void;
  player_finished: (data: { socketId: string; timeMs: number }) => void;
  dnf_warning: (data: { secondsLeft: number }) => void;
  track_results: (results: TrackResult[]) => void;
  load_next_track: (data: { trackId: string }) => void;
  session_podium: (data: { rankedPlayers: PodiumEntry[] }) => void;
  game_paused: (data: { bySocketId: string }) => void;
  game_resumed: () => void;
}

export interface ClientToServerEvents {
  list_rooms: () => void;
  create_room: (
    data: { nickname: string; settings: RoomSettings },
    cb: (room: RoomSnapshot) => void
  ) => void;
  join_room: (
    data: { roomId: string; nickname: string },
    cb: (result: { ok: boolean; room?: RoomSnapshot; error?: string }) => void
  ) => void;
  launch_game: (data: { availableTrackIds: string[] }) => void;
  ready_to_race: () => void;
  update_position: (data: { x: number; y: number; rotation: number }) => void;
  lap_complete: (data: { lapMs: number; lapNumber: number }) => void;
  race_finished: (data: { timeMs: number }) => void;
  pause_request: () => void;
  resume_request: () => void;
}
