import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: [
      "dist/**",
      ".expo/**",
      ".expo-smoke/**",
      // `expo export --platform web` output. Minified bundles, so linting it
      // reports hundreds of no-var/no-undef errors against generated code.
      ".expo-export-test/**",
    ],
  },
];
