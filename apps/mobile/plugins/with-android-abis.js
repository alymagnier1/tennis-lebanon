/**
 * Builds Android native code for ARM only.
 *
 * React Native compiles every native library once per CPU type. The 0.1.0
 * APK carried four copies -- arm64-v8a, armeabi-v7a, x86, x86_64 -- and at
 * 116 MB, about 42 MB of it was the two x86 copies, which no phone uses. The
 * emulator the team tests on runs ARM code through Android's translation
 * layer (`ro.product.cpu.abilist` is `x86_64,arm64-v8a`), so it keeps working,
 * more slowly. armeabi-v7a stays for older 32-bit phones.
 *
 * This changes which CPU types are compiled, not which native code exists, so
 * it does not need a runtime version bump: an update built for one build runs
 * on the other (2026-09-26 decision).
 *
 * Plain JS for the same reason as `app.config.js`: eas-cli evaluates it
 * without a TypeScript loader.
 */
const { withGradleProperties } = require("expo/config-plugins");

const ARCHITECTURES_PROPERTY = "reactNativeArchitectures";
const DEFAULT_ABIS = ["armeabi-v7a", "arm64-v8a"];

/**
 * Returns `properties` with `reactNativeArchitectures` set to `abis`, replacing
 * the template's value rather than adding a second line.
 *
 * @param {Array<{ type: string; key?: string; value?: string }>} properties
 * @param {string[]} abis
 */
function setReactNativeArchitectures(properties, abis) {
  if (abis.length === 0) {
    throw new Error("with-android-abis: at least one ABI is required");
  }
  return [
    ...properties.filter(
      (item) =>
        !(item.type === "property" && item.key === ARCHITECTURES_PROPERTY),
    ),
    { type: "property", key: ARCHITECTURES_PROPERTY, value: abis.join(",") },
  ];
}

/**
 * @param {import("expo/config").ExpoConfig} config
 * @param {{ abis?: string[] } | undefined} options
 */
function withAndroidAbis(config, options) {
  const abis = (options && options.abis) || DEFAULT_ABIS;
  return withGradleProperties(config, (modConfig) => {
    modConfig.modResults = setReactNativeArchitectures(
      modConfig.modResults,
      abis,
    );
    return modConfig;
  });
}

module.exports = withAndroidAbis;
module.exports.setReactNativeArchitectures = setReactNativeArchitectures;
module.exports.DEFAULT_ABIS = DEFAULT_ABIS;
