import type { MediaStateRecord } from "../../shared/types";

export function isMediaStatePlaying(state: MediaStateRecord): boolean {
  return !state.paused && (state.readyState || 0) >= 2;
}

export function sortMediaStatesByPriority(states: MediaStateRecord[]): MediaStateRecord[] {
  return [...states].sort((a, b) => {
    const aPlaying = isMediaStatePlaying(a);
    const bPlaying = isMediaStatePlaying(b);
    if (aPlaying !== bPlaying) {
      return aPlaying ? -1 : 1;
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

export function selectCurrentMediaState(states: MediaStateRecord[]): MediaStateRecord | null {
  return sortMediaStatesByPriority(states)[0] ?? null;
}
