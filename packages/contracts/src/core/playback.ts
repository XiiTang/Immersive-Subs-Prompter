import type { LoopSnapshot } from "./loop.js";

export interface PlaybackSnapshot {
  playbackRate: number;
  currentTime: number;
  duration: number | null;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  updatedAt: number;
  loop: LoopSnapshot | null;
}

export interface PlaybackProjectionInput {
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
  paused: boolean;
  duration?: number | null;
}

export interface PlaybackProjection {
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
}

export function projectPlaybackSnapshot(input: PlaybackProjectionInput, now = Date.now()): PlaybackProjection {
  const targetTime = readPositiveFiniteTimestamp(now, "Projection target time");
  const sampleTime = readPositiveFiniteTimestamp(input.updatedAt, "Playback snapshot updatedAt");
  const currentTime = readNonNegativeFiniteNumber(input.currentTime, "Playback snapshot currentTime");
  const paused = readBoolean(input.paused, "Playback snapshot paused");
  const sourcePlaybackRate = paused
    ? readNonNegativeFiniteNumber(input.playbackRate, "Playback snapshot playbackRate")
    : readPositiveFiniteNumber(input.playbackRate, "Playback snapshot playbackRate");
  const playbackRate = paused ? 0 : sourcePlaybackRate;
  const elapsed = Math.max(0, targetTime - sampleTime);
  const projectedTime = paused ? currentTime : currentTime + elapsed * playbackRate;
  const duration = readDuration(input.duration);

  return {
    currentTime: clampPlaybackTime(projectedTime, duration),
    updatedAt: targetTime,
    playbackRate
  };
}

function readPositiveFiniteTimestamp(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite timestamp`);
  }
  return value;
}

function readPositiveFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number`);
  }
  return value;
}

function readNonNegativeFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`);
  }
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function readDuration(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Playback snapshot duration must be null or a non-negative finite number");
  }
  return value;
}

function clampPlaybackTime(value: number, duration: number | null): number {
  const lowerClamped = Math.max(0, value);
  return duration === null ? lowerClamped : Math.min(lowerClamped, duration);
}
