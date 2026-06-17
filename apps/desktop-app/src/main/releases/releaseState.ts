import type { ProgressInfo, ReleaseNoteInfo, UpdateInfo } from "builder-util-runtime";

export type ReleaseStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export type ReleaseErrorCode =
  | "check-failed"
  | "download-failed"
  | "install-failed"
  | "download-unavailable"
  | "install-unavailable";

export interface SafeUpdateInfo {
  version: string;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
}

export interface ReleaseProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface ReleaseState {
  status: ReleaseStatus;
  currentVersion: string;
  latestVersion: string | null;
  checkedAt: number | null;
  updateInfo: SafeUpdateInfo | null;
  progress: ReleaseProgress | null;
  error: {
    code: ReleaseErrorCode;
    message: string;
  } | null;
}

export function createInitialReleaseState(currentVersion: string): ReleaseState {
  return {
    status: "idle",
    currentVersion,
    latestVersion: null,
    checkedAt: null,
    updateInfo: null,
    progress: null,
    error: null
  };
}

export function normalizeUpdateInfo(updateInfo: UpdateInfo): SafeUpdateInfo {
  return {
    version: updateInfo.version,
    releaseName: updateInfo.releaseName ?? null,
    releaseDate: updateInfo.releaseDate ?? null,
    releaseNotes: normalizeReleaseNotes(updateInfo.releaseNotes)
  };
}

export function normalizeProgress(progress: ProgressInfo): ReleaseProgress {
  return {
    percent: clampPercent(progress.percent),
    bytesPerSecond: Math.max(0, Math.round(progress.bytesPerSecond)),
    transferred: Math.max(0, Math.round(progress.transferred)),
    total: Math.max(0, Math.round(progress.total))
  };
}

function normalizeReleaseNotes(notes: UpdateInfo["releaseNotes"]): string | null {
  if (typeof notes === "string") {
    const trimmed = notes.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(notes)) {
    const text = notes
      .map((note: ReleaseNoteInfo) => note.note?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim();
    return text ? text : null;
  }
  return null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
