#!/usr/bin/env node
// Fails if a truly-empty catch handler is found. Empty catches hide failures in prod.
// Use the process-local `swallow(err, context, reason)` helper if you really need to ignore an error.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCAN_DIRS = ["apps/desktop-app/src", "apps/extension/src", "packages", "plugins"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".turbo", "out"]);
const EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".vue", ".js", ".mjs", ".cjs"]);

// matches:
//   catch {}         catch (e) {}        catch (e) { /* comment only */ }
//   .catch(() => {}) .catch((e) => {})   .catch(e => {})  (with comment-only body)
const EMPTY_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n?\s*)*\}/g;
const EMPTY_PROMISE_CATCH = /\.catch\(\s*(?:\([^)]*\)|[\w$]+)\s*=>\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n?\s*)*\}\s*\)/g;

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (EXT.has(path.extname(entry))) {
      scan(full);
    }
  }
}

function scan(file) {
  const src = readFileSync(file, "utf8");
  for (const pattern of [EMPTY_CATCH, EMPTY_PROMISE_CATCH]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(src)) !== null) {
      if (hasAdjacentAllowComment(src, match.index)) {
        continue;
      }
      const line = src.slice(0, match.index).split("\n").length;
      findings.push({ file: path.relative(ROOT, file), line, snippet: match[0].replace(/\s+/g, " ") });
    }
  }
}

function hasAdjacentAllowComment(src, index) {
  const lineStart = src.lastIndexOf("\n", index - 1) + 1;
  if (lineStart === 0) {
    return false;
  }
  const previousLineEnd = lineStart - 1;
  const previousLineStart = src.lastIndexOf("\n", previousLineEnd - 1) + 1;
  const previousLine = src.slice(previousLineStart, previousLineEnd).trim();
  return previousLine.includes("usp-allow-empty-catch");
}

for (const rel of SCAN_DIRS) {
  const dir = path.join(ROOT, rel);
  try {
    walk(dir);
  } catch (e) {
    // directory doesn't exist yet; skip
  }
}

if (findings.length > 0) {
  console.error(`\nFound ${findings.length} silent catch block(s):\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}   ${f.snippet}`);
  }
  console.error(
    `\nReplace each with the process-local swallow(err, "scope.name", "why this is safe to ignore") helper,\n` +
      `or add a comment containing "usp-allow-empty-catch" on the line above the catch block.\n`
  );
  process.exit(1);
}

console.log("No silent catches found.");
