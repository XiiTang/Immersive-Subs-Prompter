#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeWordListToJsonl, validateWordListJsonl } from "./wordListValidator.js";

interface CliOptions {
  input: string;
  output: string | null;
  checkOnly: boolean;
}

function printUsage(): never {
  console.error([
    "Usage:",
    "  pnpm word-list:normalize <input> [output]",
    "  pnpm word-list:normalize --check <input>",
    "",
    "Input may be JSONL, a JSON array, a single { word, content } object, or { entries: [...] }."
  ].join("\n"));
  process.exit(2);
}

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const checkOnlyIndex = args.indexOf("--check");
  const checkOnly = checkOnlyIndex !== -1;
  if (checkOnly) {
    args.splice(checkOnlyIndex, 1);
  }

  const input = args[0];
  if (!input) {
    printUsage();
  }

  return {
    input,
    output: checkOnly ? null : args[1] ?? defaultOutputPath(input),
    checkOnly
  };
}

function defaultOutputPath(input: string): string {
  const parsed = path.parse(input);
  return path.join(parsed.dir, `${parsed.name}.jsonl`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readFile(options.input, "utf8");

  if (options.checkOnly) {
    const result = validateWordListJsonl(raw);
    if (!result.ok) {
      console.error(`Invalid word list: ${result.errors.join("; ")}`);
      process.exit(1);
    }
    console.log(`Valid word list: ${result.entryCount} entries`);
    return;
  }

  const result = normalizeWordListToJsonl(raw, { skipInvalid: true });
  if (!options.output) {
    printUsage();
  }
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, result.jsonl, "utf8");
  console.log(`Wrote ${result.entryCount} entries to ${options.output}`);
  if (result.skippedRows.length) {
    console.warn(`Skipped ${result.skippedRows.length} invalid row(s):`);
    for (const row of result.skippedRows.slice(0, 20)) {
      console.warn(`- ${row.error}`);
    }
    if (result.skippedRows.length > 20) {
      console.warn(`- ... ${result.skippedRows.length - 20} more`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
