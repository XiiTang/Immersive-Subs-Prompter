export type UrlRuleMatchType = "domain" | "glob" | "exact" | "regex" | "contains";

export interface ParsedUrlRule {
  type: UrlRuleMatchType;
  pattern: string;
  error: "empty" | "invalid-regex" | null;
}

const REGEX_PREFIX = "re:";
const CONTAINS_PREFIX = "contains:";
const EXACT_PREFIX = "=";

export function parseUrlRulePattern(rawPattern: string): ParsedUrlRule {
  const pattern = rawPattern.trim();
  if (!pattern) {
    return { type: "domain", pattern: "", error: "empty" };
  }

  if (pattern.startsWith(REGEX_PREFIX)) {
    const regexPattern = pattern.slice(REGEX_PREFIX.length).trim();
    return {
      type: "regex",
      pattern: regexPattern,
      error: isValidRuleRegex(regexPattern) ? null : "invalid-regex"
    };
  }

  if (pattern.startsWith(CONTAINS_PREFIX)) {
    return {
      type: "contains",
      pattern: pattern.slice(CONTAINS_PREFIX.length).trim(),
      error: null
    };
  }

  if (pattern.startsWith(EXACT_PREFIX)) {
    return {
      type: "exact",
      pattern: pattern.slice(EXACT_PREFIX.length).trim(),
      error: null
    };
  }

  return {
    type: shouldUseGlobRule(pattern) ? "glob" : "domain",
    pattern,
    error: null
  };
}

export function getUrlRuleMatchType(rawPattern: string): UrlRuleMatchType {
  return parseUrlRulePattern(rawPattern).type;
}

export function matchesUrlRule(url: string, rawPattern: string): boolean {
  const parsed = parseUrlRulePattern(rawPattern);
  if (!parsed.pattern || parsed.error) {
    return false;
  }

  switch (parsed.type) {
    case "exact":
      return url === parsed.pattern;
    case "regex":
      return new RegExp(parsed.pattern).test(url);
    case "contains":
      return url.toLowerCase().includes(parsed.pattern.toLowerCase());
    case "glob":
      return matchesUrlGlob(url, parsed.pattern);
    case "domain":
    default:
      return matchesDomainRule(url, parsed.pattern);
  }
}

function shouldUseGlobRule(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("/") || pattern.includes("?") || pattern.includes("#");
}

function isValidRuleRegex(pattern: string): boolean {
  if (!pattern) {
    return false;
  }
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function matchesDomainRule(url: string, pattern: string): boolean {
  const target = parseUrl(url);
  if (!target) {
    return false;
  }

  const normalizedPattern = stripUrlScheme(pattern).replace(/^\*+\./, "").toLowerCase();
  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.includes(":")) {
    const host = target.host.toLowerCase();
    return host === normalizedPattern || host.endsWith(`.${normalizedPattern}`);
  }

  const hostname = target.hostname.toLowerCase();
  if (normalizedPattern.includes(".")) {
    return hostname === normalizedPattern || hostname.endsWith(`.${normalizedPattern}`);
  }

  return hostname.split(".").includes(normalizedPattern);
}

function matchesUrlGlob(url: string, pattern: string): boolean {
  const target = parseUrl(url);
  if (!target) {
    return globToRegex(pattern, "i").test(url);
  }

  const parsedPattern = splitUrlPattern(pattern);
  if (!parsedPattern.hostPattern) {
    return globToRegex(pattern, "i").test(url);
  }

  if (parsedPattern.schemePattern) {
    const schemeRegex = globToRegex(parsedPattern.schemePattern, "i");
    if (!schemeRegex.test(target.protocol.replace(/:$/, ""))) {
      return false;
    }
  }

  if (!matchesHostPattern(target, parsedPattern.hostPattern)) {
    return false;
  }

  if (!parsedPattern.pathPattern) {
    return true;
  }

  const targetPath = `${target.pathname}${target.search}${target.hash}`;
  return globToRegex(parsedPattern.pathPattern, "i").test(targetPath);
}

function matchesHostPattern(target: URL, hostPattern: string): boolean {
  const normalized = hostPattern.toLowerCase();
  if (!normalized.includes("*")) {
    if (normalized.includes(":")) {
      const host = target.host.toLowerCase();
      return host === normalized || host.endsWith(`.${normalized}`);
    }
    const hostname = target.hostname.toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  }

  return globToRegex(normalized, "i").test(target.host.toLowerCase());
}

function splitUrlPattern(pattern: string): {
  schemePattern: string | null;
  hostPattern: string;
  pathPattern: string;
} {
  const schemeMatch = pattern.match(/^([a-zA-Z][a-zA-Z\d+.-]*):\/\//);
  const schemePattern = schemeMatch?.[1] ?? null;
  const withoutScheme = schemeMatch ? pattern.slice(schemeMatch[0].length) : pattern;
  const pathStart = withoutScheme.search(/[/?#]/);
  if (pathStart === -1) {
    return {
      schemePattern,
      hostPattern: withoutScheme,
      pathPattern: ""
    };
  }
  return {
    schemePattern,
    hostPattern: withoutScheme.slice(0, pathStart),
    pathPattern: withoutScheme.slice(pathStart)
  };
}

function stripUrlScheme(pattern: string): string {
  return pattern.replace(/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//, "").replace(/\/.*$/, "");
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function globToRegex(pattern: string, flags = ""): RegExp {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`, flags);
}
