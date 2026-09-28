import { Image, StyleSheet, View } from "react-native";
import { tennisChat } from "../../theme/tennis-tokens";

/**
 * The tennis doodle wallpaper behind the match chat, as in WhatsApp's chats.
 *
 * One phone-shaped sheet of line art (`chat-doodles.webp`, 851x1847, the
 * founder's artwork, 2026-09-26) stored as a white-on-transparent mask and
 * tinted per colour scheme, so the same file serves light and dark mode.
 * `cover` fills the chat area; the sheet is about a phone's aspect ratio, so
 * little is cropped.
 *
 * Chat only: a pattern behind Home or the match hub would fight their hierarchy.
 * Decorative, so hidden from screen readers and never touchable.
 */
export function ChatDoodles() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Image
        source={require("../../../assets/chat-doodles.webp")}
        resizeMode="cover"
        style={{
          width: "100%",
          height: "100%",
          tintColor: tennisChat.doodleInk,
          opacity: tennisChat.doodleOpacity,
        }}
      />
    </View>
  );
}
