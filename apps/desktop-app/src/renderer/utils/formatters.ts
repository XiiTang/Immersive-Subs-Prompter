const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "webm", "wav", "flac", "opus", "ogg"];

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor((milliseconds ?? 0) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isAudioExtension(value: string): boolean {
  return AUDIO_EXTENSIONS.includes(value.toLowerCase());
}

function extractTranscriptionLabel(sourceFile: string, transcriptionNames: string[] = []): string | null {
  const lower = sourceFile.toLowerCase();
  for (const name of transcriptionNames) {
    const normalized = name.toLowerCase();
    const marker = `.${normalized}.`;
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      return sourceFile.slice(idx + 1);
    }
  }
  return null;
}

export function formatSourceFile(sourceFile: string, transcriptionNames: string[] = []): string {
  const trimmed = sourceFile?.trim();
  if (!trimmed) {
    return sourceFile;
  }

  const transcriptionLabel = extractTranscriptionLabel(trimmed, transcriptionNames);
  if (transcriptionLabel) {
    return transcriptionLabel;
  }

  const parts = trimmed.split(".");
  if (parts.length >= 5 && isUuidLike(parts[0]) && isAudioExtension(parts[1])) {
    return parts.slice(2).join(".");
  }

  if (parts.length >= 2 && isUuidLike(parts[0])) {
    return parts.slice(1).join(".");
  }

  return trimmed;
}
