import { normalizeVersion, assertUnifiedPackageVersions } from "./utils.mjs";

const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
const expectedVersion = args.tag ? normalizeVersion(args.tag) : null;

const version = assertUnifiedPackageVersions(process.cwd(), expectedVersion);

console.log(`Release preflight passed for ${version}`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    parsed[key.slice(2)] = value;
    index += 1;
  }
  return parsed;
}
