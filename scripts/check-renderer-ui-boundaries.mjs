import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const rendererRoot = path.join(repoRoot, "apps/desktop-app/src/renderer");
const productRoots = [
  path.join(rendererRoot, "components/settings"),
  path.join(rendererRoot, "components/top-panel"),
  path.join(rendererRoot, "components/subtitle")
];

const externalUiImportPatterns = [
  /from\s+["']antd(?:\/|["'])/,
  /from\s+["']@ant-design\//,
  /from\s+["']@arco-design\//,
  /from\s+["']element-plus(?:\/|["'])/,
  /from\s+["']naive-ui(?:\/|["'])/,
  /from\s+["']vuetify(?:\/|["'])/,
  /from\s+["']reka-ui(?:\/|["'])/,
  /from\s+["']radix-vue(?:\/|["'])/,
  /from\s+["']@radix-ui\//,
  /from\s+["']@headlessui\//,
  /from\s+["']@mui\//,
  /from\s+["']@chakra-ui\//,
  /from\s+["']@mantine\//,
  /from\s+["']@fluentui\//,
  /from\s+["']@douyinfe\/semi-/,
  /from\s+["']tailwindcss(?:\/|["'])/,
  /from\s+["']@tailwindcss\//,
  /from\s+["']unocss(?:\/|["'])/,
  /from\s+["']@unocss\//
];

const foundationChromeSelectorGroups = [
  {
    kind: "control",
    pattern: /\.ui-(?:button|icon-button|input|textarea|select|switch|slider|segmented|color-input)(?:\b|[#.:[\s])/
  },
  {
    kind: "feedback",
    pattern: /\.ui-(?:status|badge|message|empty-state|progress)(?:\b|[#.:[\s])/
  },
  {
    kind: "structure",
    pattern: /\.ui-(?:surface|toolbar|setting-row|list-item|chip|stat|group)(?:\b|[#.:[\s])/
  }
];
const chromeDeclarationPattern = /(?:^|[;\s])(?:width|height|min-height|border|border-color|border-radius|background|color|padding|outline|font-size|line-height)\s*:/;
const productCssSectionMarker = "/* Product surfaces */";

const failures = [];

for (const file of walk(rendererRoot)) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);
  for (const pattern of externalUiImportPatterns) {
    if (pattern.test(text)) {
      failures.push(`${rel}: imports a blocked external UI/style framework (${pattern})`);
    }
  }
}

for (const root of productRoots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(repoRoot, file);
    for (const failure of findProductUiChromeOverrides(text)) {
      failures.push(`${rel}: overrides foundation ${failure.kind} chrome (${failure.selector})`);
    }
  }
}

const rendererStylesheet = path.join(rendererRoot, "style.css");
for (const failure of findProductUiChromeOverrides(readFileSync(rendererStylesheet, "utf8"), {
  onlyAfterMarker: productCssSectionMarker
})) {
  failures.push(
    `${path.relative(repoRoot, rendererStylesheet)}: overrides foundation ${failure.kind} chrome (${failure.selector})`
  );
}

if (failures.length) {
  console.error("Renderer UI boundary check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Renderer UI boundary check passed.");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "coverage") {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (/\.(?:test|browser\.test)\.(?:ts|tsx|js)$/.test(entry)) {
      continue;
    }
    if (/\.(vue|ts|tsx|js|mjs|css)$/.test(entry)) {
      yield fullPath;
    }
  }
}

function findProductUiChromeOverrides(text, options = {}) {
  const cssBlocks = options.onlyAfterMarker
    ? [text.slice(text.indexOf(options.onlyAfterMarker) >= 0 ? text.indexOf(options.onlyAfterMarker) : 0)]
    : extractStyleBlocks(text);
  const failures = [];

  for (const css of cssBlocks) {
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      const selector = rule[1]?.trim() ?? "";
      const declarations = rule[2] ?? "";
      const group = foundationChromeSelectorGroups.find(({ pattern }) => pattern.test(selector));
      if (group && chromeDeclarationPattern.test(declarations)) {
        failures.push({
          kind: group.kind,
          selector: selector.replace(/\s+/g, " ")
        });
      }
    }
  }

  return failures;
}

function extractStyleBlocks(text) {
  const blocks = [];
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}
