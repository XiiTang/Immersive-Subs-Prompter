export function normalizeFasterWhisperModelName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("faster-whisper-") ? trimmed.replace(/^faster-whisper-/, "") : trimmed;
}
