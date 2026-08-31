/**
 * Expo reads `app.json` first and passes it in as `config`; everything here is
 * layered on top of it.
 *
 * Exists for `extra.eas.projectId`. Without it Notifications.getExpoPushTokenAsync
 * cannot run. Prefer EAS_PROJECT_ID env; otherwise keep whatever eas init wrote
 * into app.json.
 *
 * Plain JS so `eas-cli` can evaluate this without a TypeScript loader
 * (`import type` was breaking `eas init` with Unexpected token '{').
 */
module.exports = ({ config }) => {
  const projectId =
    (process.env.EAS_PROJECT_ID && process.env.EAS_PROJECT_ID.trim()) ||
    (config.extra && config.extra.eas && config.extra.eas.projectId) ||
    undefined;

  return {
    ...config,
    name: config.name || "Tennis Lebanon",
    slug: config.slug || "tennis-lebanon",
    extra: {
      ...(config.extra || {}),
      eas: {
        ...((config.extra && config.extra.eas) || {}),
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
