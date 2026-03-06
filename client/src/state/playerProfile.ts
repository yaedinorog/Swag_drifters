const KEY = "drift_player_name";

export const getPlayerName = (): string | null => localStorage.getItem(KEY);
export const setPlayerName = (name: string): void => localStorage.setItem(KEY, name);
export const clearPlayerName = (): void => localStorage.removeItem(KEY);
