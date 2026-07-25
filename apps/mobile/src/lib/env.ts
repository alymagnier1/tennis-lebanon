import { loadClientEnv } from "@tennis-lebanon/config/env";

/**
 * Validated at import time so a missing/invalid variable fails fast on app
 * start instead of surfacing as a confusing runtime error deep in a screen.
 */
export const env = loadClientEnv(process.env, "EXPO_PUBLIC_");
