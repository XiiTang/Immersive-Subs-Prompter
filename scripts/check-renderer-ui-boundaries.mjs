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

const duplicateChromePatterns = [
  /class=["'][^"']*\bsettings-field__label\b/,
  /class=["'][^"']*\bsettings-field__error\b/,
  /class=["'][^"']*\bglobal-settings__row-meta\b/,
  /class=["'][^"']*\bglobal-settings__control\b/,
  /class=["'][^"']*\bplayback-toggle-btn\b/,
  /class=["'][^"']*\bauto-hide-toggle\b/,
  /class=["'][^"']*\btranscription-btn\b/,
  /class=["'][^"']*\btranscript-block__play-btn\b/,
  /class=["'][^"']*\btranscript-block__ab-btn\b/,
  /class=["'][^"']*\btranscript-block__loop-btn\b/,
  /class=["'][^"']*\bplugin-server-list__delete\b/,
  /class=["'][^"']*\bword-lookup-popover--window\b/
];
const productUiChromeSelectorPattern = /\.ui-(?:button|icon-button|input|textarea|select|switch|slider|segmented|color-input)(?:\b|[#.:[\s])/;
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
    for (const pattern of duplicateChromePatterns) {
      if (pattern.test(text)) {
        failures.push(`${rel}: uses duplicate shared-control chrome (${pattern})`);
      }
    }
    for (const failure of findProductUiChromeOverrides(text)) {
      failures.push(`${rel}: overrides foundation control chrome (${failure})`);
    }
  }
}

const rendererStylesheet = path.join(rendererRoot, "style.css");
for (const failure of findProductUiChromeOverrides(readFileSync(rendererStylesheet, "utf8"), {
  onlyAfterMarker: productCssSectionMarker
})) {
  failures.push(`${path.relative(repoRoot, rendererStylesheet)}: overrides foundation control chrome (${failure})`);
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
      if (productUiChromeSelectorPattern.test(selector) && chromeDeclarationPattern.test(declarations)) {
        failures.push(selector.replace(/\s+/g, " "));
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
