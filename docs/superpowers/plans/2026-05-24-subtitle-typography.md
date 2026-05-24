# Subtitle Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent curated font family and font size controls for primary and secondary subtitles.

**Architecture:** Profile settings own four role-specific typography fields. The settings UI writes those fields directly, and `SubtitleView` normalizes the active profile before passing typography to `TranscriptSurface`. `TranscriptSurface` and `pretextLayout` use the same role-specific font family, size, and weight values for measurement and DOM styles so virtualized geometry stays aligned with rendered text.

**Tech Stack:** Electron, Vue 3, Pinia, TypeScript, Vitest browser/jsdom/main projects, `@chenglou/pretext`.

---

## File Structure

Modify these files:

- `apps/desktop-app/src/main/types.ts`: final `ProfileSettings` shape.
- `apps/desktop-app/src/main/settings/constants.ts`: default profile typography values.
- `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`: final field validation and clamping.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`: main-process settings coverage.
- `apps/desktop-app/src/main/default-settings.json`: built-in profiles use explicit primary/secondary typography.
- `apps/desktop-app/src/renderer/stores/desktop/defaults.ts`: renderer fallback profile template.
- `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`: settings controls.
- `apps/desktop-app/src/renderer/locales/en.json`: English labels.
- `apps/desktop-app/src/renderer/locales/zh.json`: Chinese labels.
- `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`: browser coverage for profile UI.
- `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`: role-specific measurement input.
- `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`: pretext alignment coverage.
- `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`: transcript surface props, layout call, rendered line styles.
- `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.browser.test.ts`: DOM style and layout coverage.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`: active profile typography normalization.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`: active profile propagation coverage.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`: fixture field names.

No new production files are needed.

### Task 1: Profile Settings Schema And Sanitizer

**Files:**
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/settings/constants.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/defaults.ts`

- [ ] **Step 1: Write failing sanitizer tests**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`, add this import:

```ts
import {
  DEFAULT_SUBTITLE_FONT_FAMILY,
  SUBTITLE_FONT_OPTIONS
} from "../../common/subtitleFonts.js";
```

Add these tests inside `describe("sanitizeSettings", () => { ... })`:

```ts
    it("sanitizes independent primary and secondary subtitle typography", () => {
      const georgiaFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Georgia")!.value;
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-typography",
            name: "Typography",
            description: null,
            settings: {
              ...DEFAULT_SETTINGS.profiles[0]!.settings,
              primarySubtitleFontFamily: "Papyrus",
              primarySubtitleFontSize: 2.2,
              secondarySubtitleFontFamily: georgiaFont,
              secondarySubtitleFontSize: 111.7
            }
          }
        ],
        defaultProfileId: "profile-typography"
      } as never);

      const settings = result.profiles[0]!.settings;

      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(3);
      expect(settings.secondarySubtitleFontFamily).toBe(georgiaFont);
      expect(settings.secondarySubtitleFontSize).toBe(96);
      expect(Object.prototype.hasOwnProperty.call(settings, "subtitleFontFamily")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(settings, "subtitleFontSize")).toBe(false);
    });

    it("uses explicit default primary and secondary subtitle typography", () => {
      const result = sanitizeSettings(null);
      const settings = result.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID)!.settings;

      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(14);
      expect(settings.secondarySubtitleFontSize).toBe(13);
      expect(Object.prototype.hasOwnProperty.call(settings, "subtitleFontFamily")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(settings, "subtitleFontSize")).toBe(false);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- appSettingsSanitizer
```

Expected: FAIL because `primarySubtitleFontFamily`, `primarySubtitleFontSize`, `secondarySubtitleFontFamily`, and `secondarySubtitleFontSize` are not yet present on sanitized profile settings.

- [ ] **Step 3: Update the profile settings type**

In `apps/desktop-app/src/main/types.ts`, replace the typography portion of `ProfileSettings` with these fields:

```ts
export interface ProfileSettings {
  primarySubtitleFontFamily: string;
  primarySubtitleFontSize: number;
  secondarySubtitleFontFamily: string;
  secondarySubtitleFontSize: number;
  subtitleAutoHideMetaRow: boolean;
  subtitlePrimarySecondaryGap: number;
  subtitleLineHeight: number;
  subtitlePrimaryColor: string;
  subtitleSecondaryColor: string;
  subtitleActivePrimaryColor: string;
  subtitleActiveSecondaryColor: string;
  ytDlpArgs: string;
  subtitleAutoScrollTimeout: number;
  subtitleScrollPosition: number;
  subtitleBlockGap: number;
  primarySubtitlePriority: string[];
  secondarySubtitlePriority: string[];
}
```

- [ ] **Step 4: Update main-process default settings**

In `apps/desktop-app/src/main/settings/constants.ts`, change `DEFAULT_PROFILE_SETTINGS` to use the final typography fields:

```ts
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  primarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  primarySubtitleFontSize: 14,
  secondarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  secondarySubtitleFontSize: 13,
  subtitleAutoHideMetaRow: true,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: DEFAULT_SUBTITLE_PRIMARY_COLOR,
  subtitleSecondaryColor: DEFAULT_SUBTITLE_SECONDARY_COLOR,
  subtitleActivePrimaryColor: DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  subtitleActiveSecondaryColor: DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  subtitleBlockGap: 12,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};
```

- [ ] **Step 5: Update profile sanitization**

In `apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts`, add constants and a helper near the imports:

```ts
const MIN_SUBTITLE_FONT_SIZE = 3;
const MAX_SUBTITLE_FONT_SIZE = 96;

function sanitizeSubtitleFontSize(value: unknown, fallback: number): number {
  let fontSize = Number(value);
  if (!Number.isFinite(fontSize)) {
    fontSize = fallback;
  }
  return Math.min(MAX_SUBTITLE_FONT_SIZE, Math.max(MIN_SUBTITLE_FONT_SIZE, Math.round(fontSize)));
}
```

Inside `sanitizeProfileSettings`, replace unified font handling with:

```ts
  const primarySubtitleFontFamily = normalizeSubtitleFontFamily(source.primarySubtitleFontFamily);
  const secondarySubtitleFontFamily = normalizeSubtitleFontFamily(source.secondarySubtitleFontFamily);
  const primarySubtitleFontSize = sanitizeSubtitleFontSize(
    source.primarySubtitleFontSize,
    DEFAULT_PROFILE_SETTINGS.primarySubtitleFontSize
  );
  const secondarySubtitleFontSize = sanitizeSubtitleFontSize(
    source.secondarySubtitleFontSize,
    DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontSize
  );
```

Return these fields at the top of the returned object:

```ts
  return {
    primarySubtitleFontFamily,
    primarySubtitleFontSize,
    secondarySubtitleFontFamily,
    secondarySubtitleFontSize,
    subtitleAutoHideMetaRow,
    subtitlePrimarySecondaryGap,
    subtitleLineHeight,
    subtitlePrimaryColor,
    subtitleSecondaryColor,
    subtitleActivePrimaryColor,
    subtitleActiveSecondaryColor,
    ytDlpArgs,
    subtitleAutoScrollTimeout,
    subtitleScrollPosition,
    subtitleBlockGap,
    primarySubtitlePriority,
    secondarySubtitlePriority
  };
```

- [ ] **Step 6: Update built-in profile JSON**

In every `settings` object in `apps/desktop-app/src/main/default-settings.json`, replace:

```json
"subtitleFontFamily": "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
"subtitleFontSize": 26,
```

with:

```json
"primarySubtitleFontFamily": "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
"primarySubtitleFontSize": 26,
"secondarySubtitleFontFamily": "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
"secondarySubtitleFontSize": 25,
```

- [ ] **Step 7: Update renderer fallback defaults**

In `apps/desktop-app/src/renderer/stores/desktop/defaults.ts`, change `DEFAULT_PROFILE_TEMPLATE` to match the main-process default shape:

```ts
export const DEFAULT_PROFILE_TEMPLATE: ProfileSettings = {
  primarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  primarySubtitleFontSize: 14,
  secondarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  secondarySubtitleFontSize: 13,
  subtitleAutoHideMetaRow: true,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: "#f5f5f5",
  subtitleSecondaryColor: "#c7d2fe",
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  subtitleBlockGap: 12,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};
```

- [ ] **Step 8: Run tests to verify Task 1 passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- appSettingsSanitizer
```

Expected: PASS for `appSettingsSanitizer`.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add apps/desktop-app/src/main/types.ts \
  apps/desktop-app/src/main/settings/constants.ts \
  apps/desktop-app/src/main/settings/sanitizers/profileSanitizer.ts \
  apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts \
  apps/desktop-app/src/main/default-settings.json \
  apps/desktop-app/src/renderer/stores/desktop/defaults.ts
git commit -m "feat: add profile subtitle typography fields"
```

### Task 2: Settings UI Controls

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

- [ ] **Step 1: Update test profile fixtures**

In `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`, update `createProfile().settings` to use:

```ts
    settings: {
      primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      primarySubtitleFontSize: 14,
      secondarySubtitleFontFamily: 'Georgia, "Times New Roman", serif',
      secondarySubtitleFontSize: 13,
      subtitleAutoHideMetaRow: true,
      subtitlePrimarySecondaryGap: 3,
      subtitleLineHeight: 1.45,
      subtitlePrimaryColor: "#f5f5f5",
      subtitleSecondaryColor: "#c7d2fe",
      subtitleActivePrimaryColor: "#fff8dc",
      subtitleActiveSecondaryColor: "#fff9c4",
      ytDlpArgs: "",
      subtitleAutoScrollTimeout: 3,
      subtitleScrollPosition: 33,
      subtitleBlockGap: 12,
      primarySubtitlePriority: [],
      secondarySubtitlePriority: []
    }
```

Also add the missing appearance section in the same test file's `createSettings().global` if it is absent:

```ts
      appearance: {
        theme: "system"
      }
```

- [ ] **Step 2: Write failing UI tests**

Replace the existing curated font test with:

```ts
  it("renders independent curated font selects for primary and secondary subtitles", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const primaryFontSelect = wrapper.find('[data-testid="primary-subtitle-font-select"]');
    const secondaryFontSelect = wrapper.find('[data-testid="secondary-subtitle-font-select"]');

    expect(primaryFontSelect.exists()).toBe(true);
    expect(primaryFontSelect.element.tagName).toBe("BUTTON");
    expect(primaryFontSelect.attributes("role")).toBe("combobox");
    expect(primaryFontSelect.text()).toContain("Helvetica Neue");
    expect(secondaryFontSelect.exists()).toBe(true);
    expect(secondaryFontSelect.element.tagName).toBe("BUTTON");
    expect(secondaryFontSelect.attributes("role")).toBe("combobox");
    expect(secondaryFontSelect.text()).toContain("Georgia");
    expect(wrapper.find('[data-testid="subtitle-font-select"]').exists()).toBe(false);
  });
```

Add this test for size inputs:

```ts
  it("renders primary and secondary subtitle size inputs with 3 to 96 bounds", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const primarySizeInput = wrapper.get<HTMLInputElement>(
      'input[aria-labelledby="primary-subtitle-font-size-label"]'
    );
    const secondarySizeInput = wrapper.get<HTMLInputElement>(
      'input[aria-labelledby="secondary-subtitle-font-size-label"]'
    );

    expect(primarySizeInput.attributes("min")).toBe("3");
    expect(primarySizeInput.attributes("max")).toBe("96");
    expect(primarySizeInput.attributes("step")).toBe("1");
    expect(primarySizeInput.element.value).toBe("14");
    expect(secondarySizeInput.attributes("min")).toBe("3");
    expect(secondarySizeInput.attributes("max")).toBe("96");
    expect(secondarySizeInput.attributes("step")).toBe("1");
    expect(secondarySizeInput.element.value).toBe("13");
  });
```

Add this test for writes:

```ts
  it("updates independent typography settings from the profile editor", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async (settings) => settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper
      .get<HTMLInputElement>('input[aria-labelledby="primary-subtitle-font-size-label"]')
      .setValue("22");
    await wrapper
      .get<HTMLInputElement>('input[aria-labelledby="secondary-subtitle-font-size-label"]')
      .setValue("18");

    expect(store.editingProfileSettings.primarySubtitleFontSize).toBe(22);
    expect(store.editingProfileSettings.secondarySubtitleFontSize).toBe(18);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- SettingsProfiles
```

Expected: FAIL because the new data test IDs, labels, and profile setting keys are not implemented yet.

- [ ] **Step 4: Implement settings typography controls**

In `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`, replace the first row with:

```vue
    <div class="subtitle-style-fields__row">
      <UiField id="primary-subtitle-font" :label="t('primary-subtitle-font-label', 'Primary Subtitle Font')">
        <UiSelect
          v-model="primarySubtitleFontFamily"
          data-testid="primary-subtitle-font-select"
          :options="subtitleFontOptions"
        />
      </UiField>
      <UiField id="primary-subtitle-font-size" :label="t('primary-subtitle-font-size-label', 'Primary Subtitle Font Size')">
        <UiInput v-model="primarySubtitleFontSize" type="number" min="3" max="96" step="1" />
      </UiField>
    </div>
    <div class="subtitle-style-fields__row">
      <UiField id="secondary-subtitle-font" :label="t('secondary-subtitle-font-label', 'Secondary Subtitle Font')">
        <UiSelect
          v-model="secondarySubtitleFontFamily"
          data-testid="secondary-subtitle-font-select"
          :options="subtitleFontOptions"
        />
      </UiField>
      <UiField id="secondary-subtitle-font-size" :label="t('secondary-subtitle-font-size-label', 'Secondary Subtitle Font Size')">
        <UiInput v-model="secondarySubtitleFontSize" type="number" min="3" max="96" step="1" />
      </UiField>
    </div>
```

Replace the old computed properties for unified font family and size with:

```ts
const primarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.primarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("primarySubtitleFontFamily", value)
});

const primarySubtitleFontSize = computed({
  get: () => store.editingProfileSettings.primarySubtitleFontSize,
  set: (value: number) => store.updateProfileSetting("primarySubtitleFontSize", value)
});

const secondarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.secondarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("secondarySubtitleFontFamily", value)
});

const secondarySubtitleFontSize = computed({
  get: () => store.editingProfileSettings.secondarySubtitleFontSize,
  set: (value: number) => store.updateProfileSetting("secondarySubtitleFontSize", value)
});
```

- [ ] **Step 5: Add locale labels**

In `apps/desktop-app/src/renderer/locales/en.json`, replace the unified typography labels with:

```json
  "primary-subtitle-font-label": "Primary Subtitle Font",
  "primary-subtitle-font-size-label": "Primary Subtitle Font Size",
  "secondary-subtitle-font-label": "Secondary Subtitle Font",
  "secondary-subtitle-font-size-label": "Secondary Subtitle Font Size",
```

In `apps/desktop-app/src/renderer/locales/zh.json`, replace the unified typography labels with:

```json
  "primary-subtitle-font-label": "主字幕字体",
  "primary-subtitle-font-size-label": "主字幕字号",
  "secondary-subtitle-font-label": "副字幕字体",
  "secondary-subtitle-font-size-label": "副字幕字号",
```

- [ ] **Step 6: Update paired-field layout assertions**

In the SettingsProfiles browser test named `renders compact paired subtitle fields and uses default yt-dlp args as the empty placeholder`, replace field lookups with:

```ts
    const primaryFontField = wrapper.get("#primary-subtitle-font-label").element.closest(".ui-field") as HTMLElement;
    const primaryFontSizeField = wrapper.get("#primary-subtitle-font-size-label").element.closest(".ui-field") as HTMLElement;
    const secondaryFontField = wrapper.get("#secondary-subtitle-font-label").element.closest(".ui-field") as HTMLElement;
    const secondaryFontSizeField = wrapper.get("#secondary-subtitle-font-size-label").element.closest(".ui-field") as HTMLElement;
    const metaAutoHideField = wrapper.get("#subtitle-meta-auto-hide-label").element.closest(".ui-field") as HTMLElement;
    const autoScrollField = wrapper.get("#subtitle-autoscroll-label").element.closest(".ui-field") as HTMLElement;
    const ytDlpTextarea = wrapper.get<HTMLTextAreaElement>('textarea[aria-labelledby="yt-dlp-args-label"]');

    expect(primaryFontField.getBoundingClientRect().top).toBe(primaryFontSizeField.getBoundingClientRect().top);
    expect(secondaryFontField.getBoundingClientRect().top).toBe(secondaryFontSizeField.getBoundingClientRect().top);
    expect(metaAutoHideField.getBoundingClientRect().top).toBe(autoScrollField.getBoundingClientRect().top);
    expect(wrapper.text()).not.toContain("Leave blank to use default arguments.");
    expect(ytDlpTextarea.attributes("placeholder")).toBe(DEFAULT_YTDLP_ARGS);
    expect(ytDlpTextarea.element.value).toBe("");
```

Replace any remaining test expectation for `[data-testid="subtitle-font-select"]` with `[data-testid="primary-subtitle-font-select"]` when the assertion only needs to prove the editor is visible.

- [ ] **Step 7: Run tests to verify Task 2 passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- SettingsProfiles
```

Expected: PASS for `SettingsProfiles`.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue \
  apps/desktop-app/src/renderer/locales/en.json \
  apps/desktop-app/src/renderer/locales/zh.json \
  apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts
git commit -m "feat: add subtitle typography profile controls"
```

### Task 3: Pretext Layout With Role-Specific Typography

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`

- [ ] **Step 1: Update pretext test input shape**

In `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`, replace `baseInput` with:

```ts
  const baseInput = {
    blocks,
    width: 180,
    primaryFontSize: 16,
    secondaryFontSize: 12,
    lineHeight: 1.5,
    primaryFontFamily: "Arial",
    secondaryFontFamily: "Georgia",
    primarySecondaryGap: 6,
    blockGap: 12,
    metaRowHeight: 18
  } as const;
```

- [ ] **Step 2: Write failing pretext alignment tests**

Add these tests after `prepares transcript text with pre-wrap and keep-all enabled`:

```ts
  it("prepares primary and secondary text with role-specific font strings", () => {
    measureTranscriptLayout(baseInput);

    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "hello world",
      "560 16px Arial",
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "你好世界",
      "400 12px Georgia",
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
  });

  it("measures primary and secondary line heights from role-specific sizes", () => {
    const preparedTextCache = createTranscriptPreparedTextCache();
    const layout = measureTranscriptLayout({
      ...baseInput,
      preparedTextCache
    });

    expect(layout.blocks[0]!.primaryLineHeight).toBe(24);
    expect(layout.blocks[0]!.secondaryLineHeight).toBe(17.64);

    const lines = materializeTranscriptBlockLines({
      block: layout.blocks[0]!,
      width: baseInput.width,
      preparedTextCache
    });

    expect(lines[0]).toMatchObject({
      kind: "primary",
      height: 24,
      relativeTop: 18
    });
    expect(lines[1]).toMatchObject({
      kind: "secondary",
      height: 17.64,
      relativeTop: 48
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- pretextLayout
```

Expected: FAIL because `measureTranscriptLayout` still expects unified `fontFamily` and `fontSize`.

- [ ] **Step 4: Update pretext layout input type**

In `apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`, replace the typography fields in `LayoutTranscriptBlocksInput` with:

```ts
type LayoutTranscriptBlocksInput = {
  blocks: TranscriptBlock[];
  width: number;
  primaryFontSize: number;
  secondaryFontSize: number;
  lineHeight: number;
  primaryFontFamily: string;
  secondaryFontFamily: string;
  primarySecondaryGap: number;
  blockGap: number;
  metaRowHeight: number;
  preparedTextCache?: TranscriptPreparedTextCache;
};
```

- [ ] **Step 5: Update font parameter computation**

In the same file, remove `SECONDARY_FONT_SIZE_OFFSET` and replace `computeFontParams` with:

```ts
function computeFontParams({
  primaryFontSize,
  secondaryFontSize,
  lineHeight,
  primaryFontFamily,
  secondaryFontFamily
}: {
  primaryFontSize: number;
  secondaryFontSize: number;
  lineHeight: number;
  primaryFontFamily: string;
  secondaryFontFamily: string;
}) {
  const primaryLinePixelHeight = primaryFontSize * lineHeight;
  const secondaryLinePixelHeight = secondaryFontSize * lineHeight * SECONDARY_LINE_HEIGHT_RATIO;
  const primaryFont = createFont(primaryFontSize, primaryFontFamily, PRIMARY_FONT_WEIGHT);
  const secondaryFont = createFont(secondaryFontSize, secondaryFontFamily, SECONDARY_FONT_WEIGHT);
  return { primaryLinePixelHeight, secondaryLinePixelHeight, primaryFont, secondaryFont };
}
```

- [ ] **Step 6: Update `measureTranscriptLayout` parameters**

Change the destructuring signature of `measureTranscriptLayout` to:

```ts
export function measureTranscriptLayout({
  blocks,
  width,
  primaryFontSize,
  secondaryFontSize,
  lineHeight,
  primaryFontFamily,
  secondaryFontFamily,
  primarySecondaryGap,
  blockGap,
  metaRowHeight,
  preparedTextCache
}: LayoutTranscriptBlocksInput): TranscriptLayoutResult {
```

Replace the font parameter call with:

```ts
  const { primaryLinePixelHeight, secondaryLinePixelHeight, primaryFont, secondaryFont } =
    computeFontParams({
      primaryFontSize,
      secondaryFontSize,
      lineHeight,
      primaryFontFamily,
      secondaryFontFamily
    });
```

- [ ] **Step 7: Run tests to verify Task 3 passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- pretextLayout
```

Expected: PASS for `pretextLayout`.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts \
  apps/desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts
git commit -m "feat: measure transcript roles with separate typography"
```

### Task 4: Transcript Surface Rendering

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`

- [ ] **Step 1: Update surface test props**

In `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.browser.test.ts`, replace the unified typography properties in `defaultProps` with:

```ts
    primaryFontFamily: "Arial",
    primaryFontSize: 16,
    secondaryFontFamily: "Georgia",
    secondaryFontSize: 15,
```

- [ ] **Step 2: Write failing transcript surface typography test**

Replace the test named `renders transcript typography and colors from surface props` with:

```ts
  it("renders primary and secondary typography and colors from surface props", async () => {
    restoreSize = mockViewportSize(220, 220);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [blocks[0]!],
        primaryFontFamily: "Arial, sans-serif",
        primaryFontSize: 20,
        secondaryFontFamily: "Georgia, serif",
        secondaryFontSize: 14,
        lineHeight: 1.6,
        primarySecondaryGap: 4,
        activePrimaryColor: "#778899",
        activeSecondaryColor: "#aabbcc"
      })
    });

    await flushSurfaceLayout();

    const lines = wrapper.findAll(".transcript-block__line");
    const primaryLine = lines[0]!.element as HTMLElement;
    const secondaryLine = lines[1]!.element as HTMLElement;
    const initialSecondaryTop = Number.parseFloat(secondaryLine.style.top);
    const initialSecondaryLineHeight = secondaryLine.style.lineHeight;

    expect(primaryLine.style.fontFamily).toContain("Arial");
    expect(primaryLine.style.fontSize).toBe("20px");
    expect(primaryLine.style.color).toBe("rgb(119, 136, 153)");
    expect(secondaryLine.style.fontFamily).toContain("Georgia");
    expect(secondaryLine.style.fontSize).toBe("14px");
    expect(secondaryLine.style.color).toBe("rgb(170, 187, 204)");

    await wrapper.setProps({
      primaryFontFamily: '"Courier New", monospace',
      primaryFontSize: 24,
      secondaryFontFamily: '"Times New Roman", serif',
      secondaryFontSize: 18,
      lineHeight: 2,
      primarySecondaryGap: 18,
      activePrimaryColor: "#ff0000",
      activeSecondaryColor: "#00ff00"
    });
    await flushSurfaceLayout();

    const updatedLines = wrapper.findAll(".transcript-block__line");
    const updatedPrimaryLine = updatedLines[0]!.element as HTMLElement;
    const updatedSecondaryLine = updatedLines[1]!.element as HTMLElement;

    expect(updatedPrimaryLine.style.fontFamily).toContain("Courier New");
    expect(updatedPrimaryLine.style.fontSize).toBe("24px");
    expect(updatedPrimaryLine.style.color).toBe("rgb(255, 0, 0)");
    expect(updatedSecondaryLine.style.fontFamily).toContain("Times New Roman");
    expect(updatedSecondaryLine.style.fontSize).toBe("18px");
    expect(updatedSecondaryLine.style.lineHeight).not.toBe(initialSecondaryLineHeight);
    expect(updatedSecondaryLine.style.color).toBe("rgb(0, 255, 0)");
    expect(Number.parseFloat(updatedSecondaryLine.style.top)).toBeGreaterThan(initialSecondaryTop);

    wrapper.unmount();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- TranscriptSurface
```

Expected: FAIL because `TranscriptSurface` still accepts unified `fontFamily` and `fontSize` props.

- [ ] **Step 4: Update `TranscriptSurface` props**

In `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`, replace unified typography destructuring with:

```ts
  primaryFontFamily,
  primaryFontSize,
  secondaryFontFamily,
  secondaryFontSize,
```

Update the props type:

```ts
  primaryFontFamily: string;
  primaryFontSize: number;
  secondaryFontFamily: string;
  secondaryFontSize: number;
```

- [ ] **Step 5: Update layout call and cache watcher**

Change the `measureTranscriptLayout` call to:

```ts
  measureTranscriptLayout({
    blocks,
    width: surfaceWidth.value,
    primaryFontSize,
    secondaryFontSize,
    lineHeight,
    primaryFontFamily,
    secondaryFontFamily,
    primarySecondaryGap,
    blockGap,
    metaRowHeight: META_ROW_HEIGHT_PX,
    preparedTextCache
  })
```

Replace the prepared text cache watcher with:

```ts
watch(
  () => [blocks, primaryFontFamily, primaryFontSize, secondaryFontFamily, secondaryFontSize],
  () => {
    preparedTextCache.clear();
  }
);
```

- [ ] **Step 6: Update rendered line styles**

Remove the computed `secondaryFontSize` offset. In the `renderedBlocks` mapping, replace typography style values with role-specific values:

```ts
            fontFamily: line.kind === "primary" ? primaryFontFamily : secondaryFontFamily,
            fontSize: `${line.kind === "primary" ? primaryFontSize : secondaryFontSize}px`,
```

Keep color selection role-specific:

```ts
            color: line.kind === "primary"
              ? (isActive ? activePrimaryColor : primaryColor)
              : (isActive ? activeSecondaryColor : secondaryColor)
```

- [ ] **Step 7: Run tests to verify Task 4 passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- TranscriptSurface
```

Expected: PASS for `TranscriptSurface`.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue \
  apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.browser.test.ts
git commit -m "feat: render transcript roles with separate typography"
```

### Task 5: Subtitle View Propagation

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`

- [ ] **Step 1: Update SubtitleView test fixture**

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`, replace the typography fields in `createProfile().settings` with:

```ts
      primarySubtitleFontFamily: 'Georgia, "Times New Roman", serif',
      primarySubtitleFontSize: 20,
      secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      secondarySubtitleFontSize: 18,
```

- [ ] **Step 2: Write failing SubtitleView propagation assertions**

In the test named `propagates active profile typography, colors, gap, and scroll position into the transcript surface`, replace the initial typography assertions with:

```ts
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontFamily")).toContain("Georgia");
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontSize")).toBe(20);
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontFamily")).toContain("Helvetica Neue");
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontSize")).toBe(18);
    expect(initialPrimaryLine.style.fontFamily).toContain("Georgia");
    expect(initialPrimaryLine.style.fontSize).toBe("20px");
    expect(initialSecondaryLine.style.fontFamily).toContain("Helvetica Neue");
    expect(initialSecondaryLine.style.fontSize).toBe("18px");
    expect(initialPrimaryLine.style.color).toBe("rgb(119, 136, 153)");
    expect(initialSecondaryLine.style.color).toBe("rgb(170, 187, 204)");
```

Replace the profile update inside that test with:

```ts
        primarySubtitleFontFamily: '"Times New Roman", Times, serif',
        primarySubtitleFontSize: 24,
        secondarySubtitleFontFamily: "Arial, sans-serif",
        secondarySubtitleFontSize: 17,
        subtitlePrimarySecondaryGap: 18,
        subtitleLineHeight: 2,
        subtitleActivePrimaryColor: "#ff0000",
        subtitleActiveSecondaryColor: "#00ff00"
```

Replace updated typography assertions with:

```ts
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontFamily")).toContain("Times New Roman");
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontSize")).toBe(24);
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontFamily")).toContain("Arial");
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontSize")).toBe(17);
    expect(updatedPrimaryLine.style.fontFamily).toContain("Times New Roman");
    expect(updatedPrimaryLine.style.fontSize).toBe("24px");
    expect(updatedPrimaryLine.style.lineHeight).not.toBe(initialPrimaryLineHeight);
    expect(updatedPrimaryLine.style.color).toBe("rgb(255, 0, 0)");
    expect(updatedSecondaryLine.style.fontFamily).toContain("Arial");
    expect(updatedSecondaryLine.style.fontSize).toBe("17px");
    expect(updatedSecondaryLine.style.color).toBe("rgb(0, 255, 0)");
    expect(Number.parseFloat(updatedSecondaryLine.style.top)).toBeGreaterThan(initialSecondaryTop);
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- SubtitleView
```

Expected: FAIL because `SubtitleView` still passes unified typography props to `TranscriptSurface`.

- [ ] **Step 4: Update SubtitleView computed props**

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`, replace unified typography computed values with:

```ts
const MIN_SUBTITLE_FONT_SIZE = 3;
const MAX_SUBTITLE_FONT_SIZE = 96;

function normalizeSubtitleFontSize(value: number | null | undefined, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(MAX_SUBTITLE_FONT_SIZE, Math.max(MIN_SUBTITLE_FONT_SIZE, Math.round(numeric)));
}

const transcriptPrimaryFontFamily = computed(() =>
  normalizeSubtitleFontFamily(playbackProfileSettings.value.primarySubtitleFontFamily)
);
const transcriptPrimaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    playbackProfileSettings.value.primarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.primarySubtitleFontSize
  )
);
const transcriptSecondaryFontFamily = computed(() =>
  normalizeSubtitleFontFamily(playbackProfileSettings.value.secondarySubtitleFontFamily)
);
const transcriptSecondaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    playbackProfileSettings.value.secondarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.secondarySubtitleFontSize
  )
);
```

- [ ] **Step 5: Update SubtitleView template props**

In the `TranscriptSurface` call in `SubtitleView.vue`, replace:

```vue
      :font-family="transcriptFontFamily"
      :font-size="transcriptFontSize"
```

with:

```vue
      :primary-font-family="transcriptPrimaryFontFamily"
      :primary-font-size="transcriptPrimaryFontSize"
      :secondary-font-family="transcriptSecondaryFontFamily"
      :secondary-font-size="transcriptSecondaryFontSize"
```

- [ ] **Step 6: Update remaining settings shell fixtures**

In `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`, replace fixture typography fields with:

```ts
          primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          primarySubtitleFontSize: 14,
          secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          secondarySubtitleFontSize: 13,
```

Also add the `appearance: { theme: "system" }` global fixture field in this file if TypeScript reports it missing.

- [ ] **Step 7: Run tests to verify Task 5 passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- SubtitleView SettingsWindowShell
```

Expected: PASS for `SubtitleView` and `SettingsWindowShell`.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue \
  apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts \
  apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts
git commit -m "feat: pass active subtitle typography to transcript surface"
```

### Task 6: Source Cleanup And Final Verification

**Files:**
- Modify only files that still reference removed unified typography fields under `apps/desktop-app/src`.

- [ ] **Step 1: Find remaining removed field references**

Run:

```bash
rg -n "subtitleFontFamily|subtitleFontSize" apps/desktop-app/src
```

Expected before cleanup: any remaining matches are in tests or implementation files missed by earlier tasks.

- [ ] **Step 2: Replace remaining fixture references**

For every remaining profile fixture, use this final shape:

```ts
settings: {
  primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  primarySubtitleFontSize: 14,
  secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  secondarySubtitleFontSize: 13,
  subtitleAutoHideMetaRow: true,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: "#f5f5f5",
  subtitleSecondaryColor: "#c7d2fe",
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  subtitleBlockGap: 12,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
}
```

For every remaining `TranscriptSurface` prop fixture, use this final prop shape:

```ts
primaryFontFamily: "Arial",
primaryFontSize: 16,
secondaryFontFamily: "Georgia",
secondaryFontSize: 15,
```

For every remaining `measureTranscriptLayout` call, use this final input shape:

```ts
primaryFontFamily: "Arial",
primaryFontSize: 16,
secondaryFontFamily: "Georgia",
secondaryFontSize: 15,
```

- [ ] **Step 3: Verify removed field references are gone from source**

Run:

```bash
rg -n "subtitleFontFamily|subtitleFontSize" apps/desktop-app/src
```

Expected: no matches.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- TranscriptSurface SubtitleView SettingsProfiles pretextLayout appSettingsSanitizer
```

Expected: PASS for focused main, jsdom, and browser tests matching those names.

- [ ] **Step 5: Run renderer test suite**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
```

Expected: PASS for browser, jsdom, and main projects.

- [ ] **Step 6: Run desktop typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Commit cleanup and verification fixes**

If Step 2 changed files, run:

```bash
git add apps/desktop-app/src
git commit -m "test: update subtitle typography fixtures"
```

If Step 2 found no remaining source changes, do not create an empty commit.

## Self-Review

- Spec coverage: Task 1 covers final schema, defaults, sanitizer bounds, and no compatibility fields. Task 2 covers settings controls and locales. Task 3 covers pretext measurement alignment. Task 4 covers `TranscriptSurface` role-specific DOM styles. Task 5 covers active profile propagation. Task 6 covers removed field cleanup and full verification.
- Placeholder scan: no implementation step uses unspecified work. Each code-changing step includes the concrete code shape to apply.
- Type consistency: field names are consistently `primarySubtitleFontFamily`, `primarySubtitleFontSize`, `secondarySubtitleFontFamily`, `secondarySubtitleFontSize`, `primaryFontFamily`, `primaryFontSize`, `secondaryFontFamily`, and `secondaryFontSize`.

## Execution Result

- Implemented inline in the current branch per request, without subagents or a worktree.
- Per-task commits from the original plan were not created.
- Removed unified `subtitleFontFamily` and `subtitleFontSize` references from `apps/desktop-app/src`.
- Verified with:
  - `pnpm --filter @immersive-subs/desktop-app test:renderer -- TranscriptSurface SubtitleView SettingsProfiles pretextLayout appSettingsSanitizer`
  - `pnpm --filter @immersive-subs/desktop-app test:renderer`
  - `pnpm --filter @immersive-subs/desktop-app typecheck`
