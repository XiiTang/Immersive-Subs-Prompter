import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sharedUiRoot = path.join(repoRoot, "packages/ui/src");
const desktopRendererRoot = path.join(repoRoot, "apps/desktop-app/src/renderer");
const extensionRoot = path.join(repoRoot, "apps/extension");
const desktopProductRoots = [
  path.join(desktopRendererRoot, "components/settings"),
  path.join(desktopRendererRoot, "components/top-panel"),
  path.join(desktopRendererRoot, "components/subtitle")
];
const productCssFiles = [
  path.join(desktopRendererRoot, "style.css"),
  path.join(extensionRoot, "src/popup-layout.css")
];
const generatedPopupCssFiles = [
  path.join(extensionRoot, "dist/chrome/popup.css"),
  path.join(extensionRoot, "dist/firefox/popup.css")
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

const sharedPrimitiveGroups = [
  {
    kind: "control",
    classNames: [
      "ui-button",
      "ui-icon-button",
      "ui-input",
      "ui-textarea",
      "ui-select",
      "ui-switch",
      "ui-slider",
      "ui-segmented"
    ],
    componentNames: ["UiButton", "UiIconButton", "UiInput", "UiTextarea", "UiSelect", "UiSwitch", "UiSlider", "UiSegmented"]
  },
  {
    kind: "feedback",
    classNames: ["ui-status", "ui-badge", "ui-message", "ui-empty-state", "ui-progress"],
    componentNames: ["UiStatus", "UiBadge", "UiMessage", "UiEmptyState", "UiProgress"]
  },
  {
    kind: "structure",
    classNames: ["ui-list-item", "ui-chip"],
    componentNames: ["UiListItem", "UiChip"]
  }
];
const sharedPrimitiveClassKinds = new Map(
  sharedPrimitiveGroups.flatMap(({ kind, classNames }) => classNames.map((className) => [className, kind]))
);
const sharedPrimitiveComponentKinds = new Map(
  sharedPrimitiveGroups.flatMap(({ kind, componentNames }) => componentNames.map((componentName) => [componentName, kind]))
);
const foundationChromeSelectorGroups = sharedPrimitiveGroups.map(({ kind, classNames }) => ({
  kind,
  pattern: new RegExp(`\\.(${classNames.map(escapeRegExp).join("|")})(?=$|[#.:[\\s,{>])`)
}));
const chromeDeclarationPattern = /(?:^|[;\s])(?:width|height|min-height|border|border-color|border-radius|background|color|padding|outline|font-size|line-height)\s*:/;
const composedChromeDeclarationPattern = /(?:^|[;\s])(?:border|border-color|border-radius|background|color|outline|font-size|line-height)\s*:/;
const tokenDefinitionPattern = /(?:^|[{\s;])(--ui-[\w-]+)\s*:/g;

const failures = [];
const productPrimitiveClasses = findProductClassesComposedWithSharedPrimitives([
  desktopRendererRoot,
  path.join(extensionRoot, "popup.html"),
  path.join(extensionRoot, "src")
]);

if (existsSync(path.join(extensionRoot, "popup.css"))) {
  failures.push("apps/extension/popup.css: extension popup CSS must be generated from shared UI CSS and src/popup-layout.css");
}

for (const file of walkMany([desktopRendererRoot, path.join(extensionRoot, "src"), path.join(extensionRoot, "esbuild.config.ts")])) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);
  for (const pattern of externalUiImportPatterns) {
    if (pattern.test(text)) {
      failures.push(`${rel}: imports a blocked external UI/style framework (${pattern})`);
    }
  }
}

for (const file of productCssFiles) {
  if (!existsSync(file)) {
    failures.push(`${path.relative(repoRoot, file)}: required product stylesheet is missing`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);
  for (const token of findSharedTokenDefinitions(text)) {
    failures.push(`${rel}: defines shared UI token (${token})`);
  }
  for (const failure of findProductUiChromeOverrides(text, { fullCss: true })) {
    failures.push(`${rel}: overrides shared UI ${failure.kind} chrome (${failure.selector})`);
  }
  for (const failure of findProductClassChromeOverrides(text, productPrimitiveClasses)) {
    failures.push(
      `${rel}: overrides shared UI ${failure.kind} chrome through shared primitive class (${failure.selector}, .${failure.className})`
    );
  }
}

for (const root of desktopProductRoots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(repoRoot, file);
    for (const token of findSharedTokenDefinitions(text)) {
      failures.push(`${rel}: defines shared UI token (${token})`);
    }
    for (const failure of findProductUiChromeOverrides(text)) {
      failures.push(`${rel}: overrides shared UI ${failure.kind} chrome (${failure.selector})`);
    }
    for (const failure of findProductClassChromeOverrides(text, productPrimitiveClasses)) {
      failures.push(
        `${rel}: overrides shared UI ${failure.kind} chrome through shared primitive class (${failure.selector}, .${failure.className})`
      );
    }
  }
}

for (const file of generatedPopupCssFiles) {
  const rel = path.relative(repoRoot, file);
  if (!existsSync(file)) {
    failures.push(`${rel}: built extension popup CSS is missing`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  const sharedIndex = lastRequiredIndex(text, ["--ui-bg", ".ui-button"]);
  const popupIndex = text.indexOf(".popup-main");
  if (sharedIndex < 0 || popupIndex < 0 || sharedIndex > popupIndex) {
    failures.push(`${rel}: built extension popup CSS must include shared UI before popup layout`);
  }
}

if (!existsSync(path.join(sharedUiRoot, "tokens.css"))) {
  failures.push("packages/ui/src/tokens.css: required shared UI tokens file is missing");
}
if (!existsSync(path.join(sharedUiRoot, "base.css"))) {
  failures.push("packages/ui/src/base.css: required shared UI base file is missing");
}
if (!existsSync(path.join(sharedUiRoot, "primitives.css"))) {
  failures.push("packages/ui/src/primitives.css: required shared UI primitives file is missing");
}

if (failures.length) {
  console.error("Project UI boundary check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Project UI boundary check passed.");

function* walkMany(paths) {
  for (const entry of paths) {
    if (!existsSync(entry)) continue;
    const stat = statSync(entry);
    if (stat.isDirectory()) {
      yield* walk(entry);
    } else if (isSourceFile(entry)) {
      yield entry;
    }
  }
}

function* walk(dir) {
  if (!existsSync(dir)) return;
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
    if (/\.(?:test|browser\.test)\.(?:ts|tsx|js|mjs)$/.test(entry)) {
      continue;
    }
    if (isSourceFile(fullPath)) {
      yield fullPath;
    }
  }
}

function isSourceFile(file) {
  return /\.(vue|ts|tsx|js|mjs|css|html)$/.test(file);
}

function findSharedTokenDefinitions(text) {
  return [...cssBlocksFor(text)].flatMap((css) => [...css.matchAll(tokenDefinitionPattern)].map((match) => match[1]));
}

function findProductUiChromeOverrides(text, options = {}) {
  const cssBlocks = options.fullCss ? [text] : extractStyleBlocks(text);
  const failures = [];

  for (const css of cssBlocks) {
    for (const rule of stripCssImports(css).matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
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

function cssBlocksFor(text) {
  const blocks = extractStyleBlocks(text);
  return blocks.length ? blocks : [text];
}

function extractStyleBlocks(text) {
  const blocks = [];
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

function lastRequiredIndex(text, patterns) {
  let highest = -1;
  for (const pattern of patterns) {
    const index = text.indexOf(pattern);
    if (index < 0) {
      return -1;
    }
    highest = Math.max(highest, index);
  }
  return highest;
}

function findProductClassesComposedWithSharedPrimitives(paths) {
  const usage = new Map();
  for (const file of walkMany(paths)) {
    const text = readFileSync(file, "utf8");
    for (const classList of extractClassLists(text)) {
      addComposedProductClasses(usage, classList);
    }
    for (const { kind, classList } of extractVuePrimitiveClassLists(text)) {
      for (const className of classList) {
        addProductPrimitiveClassUsage(usage, className, kind);
      }
    }
  }
  return usage;
}

function addComposedProductClasses(usage, classList) {
  const primitiveKinds = new Set();
  for (const className of classList) {
    const kind = sharedPrimitiveClassKinds.get(className);
    if (kind) {
      primitiveKinds.add(kind);
    }
  }
  if (!primitiveKinds.size) {
    return;
  }
  for (const className of classList) {
    if (className.startsWith("ui-")) {
      continue;
    }
    for (const kind of primitiveKinds) {
      addProductPrimitiveClassUsage(usage, className, kind);
    }
  }
}

function addProductPrimitiveClassUsage(usage, className, kind) {
  if (!className || className.startsWith("ui-")) {
    return;
  }
  const kinds = usage.get(className) ?? new Set();
  kinds.add(kind);
  usage.set(className, kinds);
}

function extractClassLists(text) {
  const classLists = [];
  for (const match of text.matchAll(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/g)) {
    classLists.push(splitClassList(match[1] ?? ""));
  }
  for (const match of text.matchAll(/\bclassName\s*=\s*\[([\s\S]*?)\]\.join\(\s*["']\s+["']\s*\)/g)) {
    const classList = [...(match[1] ?? "").matchAll(/["']([^"']+)["']/g)].flatMap((stringMatch) =>
      splitClassList(stringMatch[1] ?? "")
    );
    classLists.push(classList);
  }
  return classLists;
}

function extractVuePrimitiveClassLists(text) {
  const classLists = [];
  for (const match of text.matchAll(/<([A-Z][\w]*)\b[\s\S]*?>/g)) {
    const componentName = match[1] ?? "";
    const kind = sharedPrimitiveComponentKinds.get(componentName);
    if (!kind) {
      continue;
    }
    const tag = match[0] ?? "";
    const classList = [];
    for (const classMatch of tag.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g)) {
      classList.push(...splitClassList(classMatch[1] ?? ""));
    }
    for (const objectClassMatch of tag.matchAll(/(?::class|v-bind:class)\s*=\s*["']\{([\s\S]*?)\}["']/g)) {
      classList.push(...[...(objectClassMatch[1] ?? "").matchAll(/["']([^"']+)["']\s*:/g)].map((classMatch) => classMatch[1] ?? ""));
    }
    classLists.push({ kind, classList });
  }
  return classLists;
}

function splitClassList(classValue) {
  return classValue.split(/\s+/).filter(Boolean);
}

function findProductClassChromeOverrides(text, classUsages) {
  const failures = [];
  for (const rule of stripCssImports(text).matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selector = rule[1]?.trim() ?? "";
    const declarations = rule[2] ?? "";
    if (!composedChromeDeclarationPattern.test(declarations)) {
      continue;
    }
    for (const [className, kinds] of classUsages) {
      if (classSelectorPattern(className).test(selector)) {
        for (const kind of kinds) {
          failures.push({
            kind,
            className,
            selector: selector.replace(/\s+/g, " ")
          });
        }
      }
    }
  }
  return failures;
}

function stripCssImports(css) {
  return css.replace(/^\s*@import[^;]+;\s*/gm, "");
}

function classSelectorPattern(className) {
  return new RegExp(`\\.${escapeRegExp(className)}(?=$|[#.:[\\s,{>])`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
