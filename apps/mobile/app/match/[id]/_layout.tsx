import { Stack } from "expo-router";

/** Nested stack so /match/:id/invite (and book/chat/…) push over the hub. */
export default function MatchIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="book" />
      <Stack.Screen name="book-external" />
      <Stack.Screen name="add-time" />
      <Stack.Screen name="reschedule" />
      <Stack.Screen name="cancel" />
      <Stack.Screen name="withdraw" />
    </Stack>
  );
}
