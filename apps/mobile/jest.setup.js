// Anything importing a screen or a shared component eventually pulls in the
// Supabase client, which validates EXPO_PUBLIC_* at import time and throws
// without it. These are obvious placeholders: no test should reach the network,
// and a real key must never sit in the repo.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ??= "tennislebanon://auth/callback";
process.env.EXPO_PUBLIC_APP_ENV ??= "local";

// The same import chain constructs a realtime client, which looks for a
// WebSocket constructor the jest environment does not provide. A stub is enough
// because nothing subscribes: a component test that needed a live socket would
// be testing the wrong thing.
globalThis.WebSocket ??= class {
  addEventListener() {}
  removeEventListener() {}
  close() {}
  send() {}
};
