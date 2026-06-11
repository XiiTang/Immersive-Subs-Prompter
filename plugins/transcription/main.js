usp.registerTranscriptionProvider({
  transcribe: async ({ videoUrl }) => usp.transcriptionRuntime.transcribe(videoUrl)
});
