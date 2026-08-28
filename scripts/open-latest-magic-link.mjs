/**
 * Redeems the newest Mailpit magic-link email and opens it in Expo Go on the
 * emulator. Do not click the email in a desktop browser — that spends the
 * one-time token outside the app.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAILPIT = "http://127.0.0.1:54324";
const adb = join(
  process.env.LOCALAPPDATA ?? "",
  "Android",
  "Sdk",
  "platform-tools",
  "adb.exe",
);

function adbArgs(args) {
  return execFileSync(adb, args, { encoding: "utf8" }).trim();
}

function rewriteCallback(location) {
  const prefix = "tennislebanon://auth/callback";
  if (!location.startsWith(prefix)) {
    throw new Error("Unexpected auth redirect.");
  }
  const rest = location.slice(prefix.length);
  const query = rest.startsWith("#") ? `?${rest.slice(1)}` : rest;
  return `exp://127.0.0.1:8081/--/auth/callback${query}`;
}

const messages = await fetch(`${MAILPIT}/api/v1/messages`).then((res) => {
  if (!res.ok) {
    throw new Error("Mailpit is not running at http://127.0.0.1:54324");
  }
  return res.json();
});

const latest = messages.messages?.[0];
if (!latest) {
  throw new Error(
    "No emails in Mailpit. Request a sign-in link in the app first.",
  );
}

const full = await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`).then((res) =>
  res.json(),
);
const verify = String(full.Text ?? "").match(/http:\/\/[^\s)]+/)?.[0];
if (!verify) {
  throw new Error("The latest Mailpit email has no sign-in URL.");
}

const verifyResponse = await fetch(verify, { redirect: "manual" });
const location = verifyResponse.headers.get("location");
if (!location) {
  throw new Error("Auth did not return a redirect. Is local Supabase running?");
}
if (/[?&#]error=/.test(location)) {
  throw new Error(
    "That sign-in link is invalid or already used. Request a new one in the app and run this again without clicking the email.",
  );
}

const expoUrl = rewriteCallback(location);
const urlFile = join(tmpdir(), "tennis-auth-callback.txt");
writeFileSync(urlFile, expoUrl, "ascii");

adbArgs(["reverse", "tcp:54321", "tcp:54321"]);
adbArgs(["reverse", "tcp:8081", "tcp:8081"]);
adbArgs(["push", urlFile, "/data/local/tmp/tennis-auth-callback.txt"]);
adbArgs([
  "shell",
  'URL=$(cat /data/local/tmp/tennis-auth-callback.txt); am start -W -n host.exp.exponent/.experience.ExperienceActivity -a android.intent.action.VIEW -d "$URL"',
]);

const to = latest.To?.[0]?.Address ?? "unknown";
console.log(`Opened the latest sign-in link in Expo Go (${to}).`);
