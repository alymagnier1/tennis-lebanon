import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";

/**
 * Secondary hub ops, always visible. Kept as a thin stack so leave / cancel /
 * withdraw stay one tap away — a "More" accordion was hiding the next job.
 */
export function MatchHubMoreSection({ children }: PropsWithChildren) {
  return <View style={styles.stack}>{children}</View>;
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    stack: {
      gap: 12,
    },
  }),
);
