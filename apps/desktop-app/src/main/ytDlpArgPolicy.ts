const DENIED_OPTIONS = new Set([
  "-o",
  "-P",
  "--output",
  "--paths",
  "--exec",
  "--exec-before-download",
  "--config-location",
  "--ignore-config",
  "--external-downloader",
  "--external-downloader-args",
  "--use-postprocessor",
  "--download-archive",
  "--write-info-json",
  "--write-description",
  "--write-thumbnail"
]);

const DENIED_SHORT_OPTIONS = ["-o", "-P"] as const;

export function parseYtDlpArgs(input: string, context: string): string[] {
  const args = splitArgs(input);
  validateYtDlpArgs(args, context);
  return args;
}

export function validateYtDlpArgLine(input: string, context: string): void {
  parseYtDlpArgs(input, context);
}

function validateYtDlpArgs(args: string[], context: string): void {
  for (const token of args) {
    if (isPositionalToken(token)) {
      throw new Error(`${context} cannot include positional yt-dlp argument`);
    }

    const deniedOption = getDeniedOption(token);
    if (deniedOption) {
      throw new Error(`${context} cannot use yt-dlp option ${deniedOption}`);
    }
  }
}

function isPositionalToken(token: string): boolean {
  return token === "-" || token === "--" || !token.startsWith("-");
}

function getDeniedOption(token: string): string | null {
  const longOption = parseLongOptionName(token);
  if (longOption !== null) {
    return DENIED_OPTIONS.has(longOption) ? longOption : null;
  }

  for (const shortOption of DENIED_SHORT_OPTIONS) {
    if (token === shortOption || token.startsWith(`${shortOption}=`) || token.startsWith(shortOption)) {
      return shortOption;
    }
  }

  return DENIED_OPTIONS.has(token) ? token : null;
}

function parseLongOptionName(token: string): string | null {
  if (!token.startsWith("--")) {
    return null;
  }
  const separator = token.indexOf("=");
  return separator < 0 ? token : token.slice(0, separator);
}

export function splitArgs(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && input[i + 1] === quote) {
        current += quote;
        i += 1;
      } else {
        current += char;
      }
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (/\s/.test(char ?? "")) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else if (char === "\\" && input[i + 1]) {
      current += input[i + 1];
      i += 1;
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }
  return result;
}
