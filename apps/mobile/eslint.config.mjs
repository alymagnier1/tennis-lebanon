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
  {
    rules: {
      // Metro bundles every file a module requires, and these packages' index
      // files require all of their fonts: every icon set, every weight and
      // italic. Importing from them shipped ~8.5 MB of fonts the app never
      // showed (2026-09-26). Import the one icon set or weight instead.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@expo/vector-icons",
              message:
                "Import one icon set, e.g. `@expo/vector-icons/Ionicons`: the package root bundles every icon font.",
            },
            {
              name: "@expo-google-fonts/inter",
              message:
                "Import one weight, e.g. `@expo-google-fonts/inter/400Regular`: the package root bundles all 18 font files.",
            },
            {
              name: "@expo-google-fonts/outfit",
              message:
                "Import one weight, e.g. `@expo-google-fonts/outfit/400Regular`: the package root bundles every weight.",
            },
          ],
        },
      ],
    },
  },
];
