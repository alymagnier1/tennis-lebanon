import { StyleSheet, View } from "react-native";
import type { PropsWithChildren } from "react";
import { AppText } from "../components/AppText";
import { figmaFormStyles } from "../components/onboarding-ui/figma-form-styles";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";

export function CreateMatchPanel({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={createMatchPanelStyles.panel}>
      <AppText
        accessibilityRole="header"
        style={createMatchPanelStyles.panelTitle}
      >
        {title}
      </AppText>
      <View style={createMatchPanelStyles.panelBody}>{children}</View>
    </View>
  );
}

export function CreateMatchSection({
  label,
  description,
  children,
}: PropsWithChildren<{
  label: string;
  description?: string;
  showDivider?: boolean;
}>) {
  return (
    <View>
      <AppText style={figmaFormStyles.fieldLabel}>{label}</AppText>
      {description ? (
        <AppText style={createMatchPanelStyles.sectionDescription}>
          {description}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const createMatchPanelStyles = StyleSheet.create({
  panel: {
    backgroundColor: tennisColors.card,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderRadius: tennisRadii.xl,
    padding: 16,
    gap: 14,
  },
  panelTitle: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 17,
    lineHeight: 22,
    color: tennisColors.primaryDark,
    letterSpacing: -0.3,
  },
  panelBody: {
    gap: 20,
  },
  sectionDescription: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
    marginBottom: 10,
  },
});

export { createMatchStyles } from "./create-match-styles";
