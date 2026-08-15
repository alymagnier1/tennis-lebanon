import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Expo reads `app.json` first and passes it in as `config`; everything here is
 * layered on top of it.
 *
 * The only thing this file exists for is `extra.eas.projectId`. Without it
 * `Notifications.getExpoPushTokenAsync` cannot be called at all, so no device
 * ever registers a push token and every notification is parked as
 * `no_delivery_channel` — see `src/lib/push-notifications.ts`. Keeping it in an
 * env var rather than committed in `app.json` lets dev, staging and production
 * builds point at different Expo projects without editing tracked files.
 *
 * `eas init` writes the id into `app.json` directly. If that has been run, the
 * value from `app.json` is preserved and the env var is optional.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EAS_PROJECT_ID?.trim() ||
    config.extra?.eas?.projectId ||
    undefined;

  return {
    ...config,
    // `config.name`/`config.slug` are required by ExpoConfig but optional on
    // the partial Expo hands us; app.json supplies both.
    name: config.name ?? "Tennis Lebanon",
    slug: config.slug ?? "tennis-lebanon",
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
