import { Image, StyleSheet, View } from "react-native";
import { tennisChat } from "../../theme/tennis-tokens";

/**
 * The tennis doodle wallpaper behind the match chat, as in WhatsApp's chats.
 *
 * One small transparent tile (`chat-doodles.png`, 240dp, white strokes) repeated
 * across the screen and tinted per colour scheme, so it stays crisp at any size
 * and costs ~70 KB at @3x. Our own artwork -- balls, rackets, net, court,
 * trophy, clock, pin, speech bubble -- drawn for this app on 2026-09-26.
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
        source={require("../../../assets/chat-doodles.png")}
        resizeMode="repeat"
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
