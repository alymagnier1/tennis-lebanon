import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Keyboard avoidance that works on Android too.
 *
 * Every call site previously passed
 * `behavior={Platform.OS === "ios" ? "padding" : undefined}`. A `KeyboardAvoidingView`
 * with no `behavior` is a **no-op** -- it renders a plain `View` -- so on Android
 * nothing moved out of the keyboard's way.
 *
 * That was correct for years: Android's `windowSoftInputMode=adjustResize` shrank
 * the window itself, and adding padding on top would have double-counted. Going
 * edge-to-edge (Android 15 / targetSdk 35) ended that -- the IME now overlays the
 * window instead of resizing it, so whatever sits at the bottom gets covered. Two
 * reports from the first two-player test were this: the chat send button, and the
 * match hub note field.
 *
 * `padding` on both platforms is the fix. Kept in one component because the exact
 * behaviour and offset are the sort of thing a real device argues with, and
 * chasing four copies of it is how they drift apart.
 */
export function KeyboardAvoider({
  children,
  style,
  offset,
  pointerEvents,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Extra gap above the keyboard. Defaults to the small iOS nudge sites used. */
  offset?: number;
  pointerEvents?: "none" | "auto";
}>) {
  return (
    <KeyboardAvoidingView
      style={style}
      behavior="padding"
      keyboardVerticalOffset={offset ?? (Platform.OS === "ios" ? 8 : 0)}
      pointerEvents={pointerEvents}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
