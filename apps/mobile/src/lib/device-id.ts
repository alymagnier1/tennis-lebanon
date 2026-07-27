import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "tennis-lebanon-device-id";

function createDeviceId(): string {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getStableDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextId = createDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, nextId);
  return nextId;
}
