const SESSION_REFRESH_MS = 2000;

const state = {
  sessionsByServer: new Map(),
  lastFetchByServer: new Map()
};

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
}

function requireStringValue(source, key, context) {
  if (typeof source[key] !== "string") {
    throw new Error(`${context} must include string ${key}.`);
  }
  return source[key].trim();
}

function requireBooleanValue(source, key, context) {
  if (typeof source[key] !== "boolean") {
    throw new Error(`${context} must include boolean ${key}.`);
  }
  return source[key];
}

function normalizeBaseUrl(url) {
  if (!URL.canParse(url)) {
    throw new Error(`Jellyfin / Emby server URL is invalid: ${url}`);
  }
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeServer(row, index) {
  const source = requireObject(row, `Jellyfin / Emby server ${index + 1}`);
  const enabled = requireBooleanValue(source, "enabled", `Jellyfin / Emby server ${index + 1}`);
  if (!enabled) {
    return null;
  }
  const serverUrl = requireStringValue(source, "serverUrl", `Jellyfin / Emby server ${index + 1}`);
  if (!serverUrl) {
    return null;
  }
  return {
    id: requireStringValue(source, "id", `Jellyfin / Emby server ${index + 1}`),
    name: requireStringValue(source, "name", `Jellyfin / Emby server ${index + 1}`),
    serverUrl: normalizeBaseUrl(serverUrl),
    apiKey: requireStringValue(source, "apiKey", `Jellyfin / Emby server ${index + 1}`),
    enabled
  };
}

function parseServers(config) {
  if (config.servers === undefined) {
    return [];
  }
  if (!Array.isArray(config.servers)) {
    throw new Error("Jellyfin / Emby servers must be configured with a server list.");
  }
  return config.servers.map((server, index) => normalizeServer(server, index)).filter(Boolean);
}

function parseOptionalUrl(value) {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  const candidate = raw.startsWith("blob:") ? raw.slice("blob:".length) : raw;
  return URL.canParse(candidate) ? new URL(candidate) : null;
}

function findServer(servers, urls) {
  for (const server of servers) {
    const base = new URL(server.serverUrl);
    const matched = urls.some((url) => {
      const parsed = parseOptionalUrl(url);
      return parsed && parsed.host === base.host;
    });
    if (matched) return server;
  }
  return null;
}

function extractItemId(payload) {
  const candidates = [payload?.pageUrl, payload?.videoSrc].filter(Boolean).map(String);
  for (const value of candidates) {
    const parsed = parseOptionalUrl(value);
    if (!parsed) continue;
    const itemId = parsed.searchParams.get("id") || parsed.searchParams.get("itemId");
    if (itemId) return itemId;
    const match = parsed.pathname.match(/\/(?:Items|items|Videos|videos|item|details)\/([A-Za-z0-9_-]+)/i);
    if (match) return match[1];
  }
  return null;
}

function createAuthHeaders(server) {
  return server.apiKey ? { "X-Emby-Token": server.apiKey } : {};
}

async function fetchJson(url, server) {
  const response = await usp.fetch(url, {
    headers: { Accept: "application/json", ...createAuthHeaders(server) }
  });
  if (!response.ok) throw new Error(`Jellyfin / Emby request failed: HTTP ${response.status}`);
  return response.json();
}

function toSubtitleStream(stream) {
  if (!stream || typeof stream !== "object") return null;
  const type = text(stream.Type)?.toLowerCase() ?? "";
  const isText = stream.IsTextSubtitleStream === true || type === "subtitle" || type === "subtitles";
  if (!isText || typeof stream.Index !== "number") return null;
  return {
    index: stream.Index,
    codec: text(stream.Codec),
    language: text(stream.Language),
    displayTitle: text(stream.DisplayTitle),
    isDefault: Boolean(stream.IsDefault),
    isForced: Boolean(stream.IsForced),
    isText: stream.IsTextSubtitleStream === true
  };
}

function collectSubtitleStreams(...collections) {
  const byIndex = new Map();
  for (const streams of collections) {
    if (!Array.isArray(streams)) continue;
    for (const stream of streams) {
      const normalized = toSubtitleStream(stream);
      if (normalized && !byIndex.has(normalized.index)) {
        byIndex.set(normalized.index, normalized);
      }
    }
  }
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function extractSubtitleStreams(mediaSource, item) {
  return collectSubtitleStreams(mediaSource?.MediaStreams, item?.MediaStreams);
}

function toSessionSummary(server, row) {
  if (!row || typeof row !== "object" || !text(row.Id)) return null;
  const nowPlayingItem = row.NowPlayingItem && typeof row.NowPlayingItem === "object" ? row.NowPlayingItem : null;
  const playState = row.PlayState && typeof row.PlayState === "object" ? row.PlayState : {};
  const mediaSources = Array.isArray(nowPlayingItem?.MediaSources) ? nowPlayingItem.MediaSources : [];
  const mediaSourceId = text(playState.MediaSourceId) ?? text(mediaSources[0]?.Id);
  const mediaSource = mediaSourceId
    ? mediaSources.find((source) => source?.Id === mediaSourceId) ?? mediaSources[0] ?? null
    : mediaSources[0] ?? null;
  return {
    id: `${server.id}:${row.Id}`,
    serverConfigId: server.id,
    serverName: server.name || server.serverUrl,
    serverType: "jellyfinemby",
    deviceName: text(row.DeviceName),
    client: text(row.Client),
    userName: text(row.UserName),
    nowPlayingItemId: text(nowPlayingItem?.Id),
    nowPlayingItemName: text(nowPlayingItem?.Name),
    mediaSourceId,
    runTimeTicks: typeof nowPlayingItem?.RunTimeTicks === "number" ? nowPlayingItem.RunTimeTicks : null,
    positionTicks: typeof playState.PositionTicks === "number" ? playState.PositionTicks : null,
    isPaused: Boolean(playState.IsPaused),
    playbackRate: typeof playState.PlaybackRate === "number" ? playState.PlaybackRate : 1,
    subtitleStreams: extractSubtitleStreams(mediaSource, nowPlayingItem)
  };
}

async function fetchSessions(server) {
  if (!server.apiKey) return [];
  const url = new URL(`${server.serverUrl}/Sessions`);
  url.searchParams.set("api_key", server.apiKey);
  const rows = await fetchJson(url.toString(), server);
  return Array.isArray(rows) ? rows.map((row) => toSessionSummary(server, row)).filter(Boolean) : [];
}

async function getSessions(server, forceRefresh) {
  const lastFetch = state.lastFetchByServer.get(server.id) ?? 0;
  const cached = state.sessionsByServer.get(server.id);
  if (!forceRefresh && cached && Date.now() - lastFetch < SESSION_REFRESH_MS) {
    return cached;
  }
  const sessions = await fetchSessions(server);
  state.sessionsByServer.set(server.id, sessions);
  state.lastFetchByServer.set(server.id, Date.now());
  return sessions;
}

async function fetchItemMetadata(server, session) {
  if (!session.nowPlayingItemId) return null;
  const url = new URL(`${server.serverUrl}/Items/${session.nowPlayingItemId}`);
  url.searchParams.set("api_key", server.apiKey);
  return fetchJson(url.toString(), server);
}

async function resolveSubtitleMetadata(server, session) {
  if (session.subtitleStreams.length && session.mediaSourceId) {
    return {
      mediaSourceId: session.mediaSourceId,
      streams: session.subtitleStreams,
      itemName: session.nowPlayingItemName
    };
  }

  const item = await fetchItemMetadata(server, session);
  if (!item || typeof item !== "object") {
    return { mediaSourceId: session.mediaSourceId, streams: session.subtitleStreams, itemName: session.nowPlayingItemName };
  }
  const mediaSources = Array.isArray(item.MediaSources) ? item.MediaSources : [];
  const mediaSourceId = session.mediaSourceId ?? text(mediaSources[0]?.Id);
  const mediaSource = mediaSourceId
    ? mediaSources.find((source) => source?.Id === mediaSourceId) ?? mediaSources[0] ?? null
    : mediaSources[0] ?? null;
  return {
    mediaSourceId,
    streams: extractSubtitleStreams(mediaSource, item),
    itemName: text(item.Name) ?? session.nowPlayingItemName
  };
}

function subtitleExtension(stream) {
  const title = (stream.displayTitle ?? "").toLowerCase();
  const codec = (stream.codec ?? "").toLowerCase();
  if (title.includes("vtt") || title.includes("webvtt") || codec.includes("vtt") || codec.includes("webvtt")) {
    return "vtt";
  }
  return "srt";
}

function buildSubtitleUrl(server, session, stream, extension) {
  const url = new URL(
    `${server.serverUrl}/Videos/${session.nowPlayingItemId}/${session.mediaSourceId}/Subtitles/${stream.index}/Stream.${extension}`
  );
  url.searchParams.set("api_key", server.apiKey);
  return url.toString();
}

function parseTimestamp(value) {
  const match = value.replace(/,/g, ".").match(/(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return Number.NaN;
  return ((match[1] ? Number(match[1]) : 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
}

function cleanSubtitleText(value) {
  return value
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .trim();
}

function parseSrt(content) {
  return content
    .replace(/\ufeff|\r/g, "")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return [];
      const timingIndex = /^\d+$/.test(lines[0]) ? 1 : 0;
      const match = lines[timingIndex]?.match(/(.+?)\s+-->\s+(.+)/);
      if (!match) return [];
      const start = parseTimestamp(match[1]);
      const end = parseTimestamp(match[2]);
      const textValue = cleanSubtitleText(lines.slice(timingIndex + 1).join("\n"));
      return Number.isNaN(start) || Number.isNaN(end) || !textValue ? [] : [{ start, end, text: textValue }];
    });
}

function parseVtt(content) {
  const lines = content.replace(/\ufeff|\r/g, "").split("\n");
  const cues = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.includes("-->")) continue;
    const [startRaw, endRaw] = line.split("-->");
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    const textLines = [];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      textLines.push(lines[index]);
      index += 1;
    }
    const textValue = cleanSubtitleText(textLines.join("\n"));
    if (!Number.isNaN(start) && !Number.isNaN(end) && textValue) {
      cues.push({ start, end, text: textValue });
    }
  }
  return cues;
}

function parseSubtitle(content, extension) {
  return extension === "vtt" ? parseVtt(content) : parseSrt(content);
}

async function loadSubtitleTracks(server, session) {
  if (!session.nowPlayingItemId) return [];
  const metadata = await resolveSubtitleMetadata(server, session);
  const workingSession = {
    ...session,
    mediaSourceId: metadata.mediaSourceId,
    nowPlayingItemName: metadata.itemName
  };
  if (!workingSession.mediaSourceId || !metadata.streams.length) return [];

  const tracks = [];
  for (const stream of metadata.streams) {
    const extension = subtitleExtension(stream);
    const response = await usp.fetch(buildSubtitleUrl(server, workingSession, stream, extension), {
      headers: {
        Accept: "text/vtt, text/plain, application/octet-stream",
        ...createAuthHeaders(server)
      }
    });
    if (!response.ok) continue;
    const cues = parseSubtitle(await response.text(), extension);
    if (cues.length) {
      tracks.push({
        id: `${workingSession.id}:${stream.index}`,
        sourceFile: stream.displayTitle ?? `${workingSession.nowPlayingItemId}#${stream.index}.${extension}`,
        cues
      });
    }
  }
  return tracks;
}

function selectSession(sessions, itemId) {
  return itemId ? sessions.find((session) => session.nowPlayingItemId === itemId) ?? null : sessions[0] ?? null;
}

function sessionPlaybackEvent(session) {
  return {
    type: "playbackSnapshot",
    sessionId: session.id,
    positionMs: session.positionTicks ? Math.round(session.positionTicks / 10000) : null,
    durationMs: session.runTimeTicks ? Math.round(session.runTimeTicks / 10000) : null,
    playbackRate: session.playbackRate ?? 1,
    paused: session.isPaused
  };
}

function clearState() {
  state.sessionsByServer.clear();
  state.lastFetchByServer.clear();
}

usp.registerMediaSourceAdapter({
  handleConnectionMessage: async (message) => {
    if (!message || typeof message !== "object") return null;
    if (!["video-context", "time-update", "playback-rate"].includes(message.type)) return null;

    const config = await usp.getConfig();
    const servers = parseServers(config);
    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
    const urls = [payload.pageUrl, payload.videoSrc].filter(Boolean);
    const server = findServer(servers, urls);
    if (!server) return null;

    const itemId = extractItemId(payload);
    const sessions = await getSessions(server, message.type === "video-context");
    const selected = selectSession(sessions, itemId);
    const events = [{ type: "sessionsChanged", sessions }];

    if (message.type !== "video-context") {
      if (selected) {
        events.push(sessionPlaybackEvent(selected));
      }
      return events;
    }

    const pageUrl = text(payload.pageUrl);
    const videoSrc = text(payload.videoSrc);
    events.unshift({
      type: "sourceMatched",
      tabId: message.tabId,
      pageUrl,
      videoUrl: pageUrl ?? videoSrc,
      title: text(payload.title) ?? selected?.nowPlayingItemName ?? null,
      site: "jellyfinemby",
      selectedSessionId: selected?.id ?? null
    });

    if (selected) {
      events.push(sessionPlaybackEvent(selected));
      events.push({
        type: "subtitleTracksLoaded",
        sessionId: selected.id,
        tracks: await loadSubtitleTracks(server, selected)
      });
    } else {
      events.push({ type: "subtitleTracksLoaded", sessionId: null, tracks: [] });
    }
    return events;
  },
  handleSettingsUpdated: async () => {
    clearState();
  },
  stop: async () => {
    clearState();
  }
});
