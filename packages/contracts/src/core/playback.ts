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
  currentTime: unknown;
  updatedAt: unknown;
  playbackRate: unknown;
  paused: unknown;
  duration?: unknown;
}

export interface PlaybackProjection {
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
}

export function projectPlaybackSnapshot(input: PlaybackProjectionInput, now = Date.now()): PlaybackProjection {
  const targetTime = normalizeTimestamp(now, Date.now());
  const sampleTime = normalizeTimestamp(input.updatedAt, targetTime);
  const paused = input.paused === true;
  const playbackRate = paused ? 0 : normalizePlaybackRate(input.playbackRate);
  const currentTime = normalizeNonNegativeNumber(input.currentTime, 0);
  const elapsed = Math.max(0, targetTime - sampleTime);
  const projectedTime = paused ? currentTime : currentTime + elapsed * playbackRate;
  const duration = normalizePositiveDuration(input.duration);

  return {
    currentTime: clampPlaybackTime(projectedTime, duration),
    updatedAt: targetTime,
    playbackRate
  };
}

function normalizeTimestamp(value: unknown, defaultValue: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function normalizePlaybackRate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeNonNegativeNumber(value: unknown, defaultValue: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : defaultValue;
}

function normalizePositiveDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function clampPlaybackTime(value: number, duration: number | null): number {
  const lowerClamped = Math.max(0, value);
  return duration === null ? lowerClamped : Math.min(lowerClamped, duration);
}
