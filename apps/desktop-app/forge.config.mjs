import path from "node:path";
import { fileURLToPath } from "node:url";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  packagerConfig: {
    asar: {
      unpackDir: "node_modules/get-windows"
    },
    icon: path.join(__dirname, "resources", "icon"),
    executableName: "Immersive Subs Prompter",
    name: "Immersive Subs Prompter",
    appBundleId: "com.sheixunixitang3.immersivesubsprompter",
    appCopyright: "Copyright (c) XiiTang",
    extraResource: [
      path.join(__dirname, "resources", "icon.ico"),
      path.join(__dirname, "resources", "icon.icns"),
      path.join(__dirname, "resources", "icon.png"),
      path.join(__dirname, "resources", "trayTemplate.png"),
      path.join(__dirname, "resources", "trayTemplate@2x.png")
    ],
    ignore: [
      /^\/release($|\/)/,
      /^\/out($|\/)/,
      /^\/src($|\/)/,
      /^\/scripts($|\/)/,
      /^\/\.vitest-(?:a|attachments|traces)($|\/)/,
      /^\/\.gitignore$/,
      /^\/tsconfig(?:\.[^.]+)?\.json$/,
      /^\/vite\.config\.ts$/,
      /^\/vitest\.config\.ts$/
    ]
  },
  rebuildConfig: {
    ignoreModules: ["get-windows"]
  },
  makers: [
    new MakerSquirrel({
      setupIcon: path.join(__dirname, "resources", "icon.ico")
    }),
    new MakerZIP({}, ["darwin", "linux", "win32"]),
    new MakerDMG({
      icon: path.join(__dirname, "resources", "icon.icns")
    }),
    new MakerDeb({}),
    new MakerRpm({})
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new FusesPlugin({
      strictlyRequireAllFuses: true,
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
      [FuseV1Options.WasmTrapHandlers]: true
    })
  ]
};
