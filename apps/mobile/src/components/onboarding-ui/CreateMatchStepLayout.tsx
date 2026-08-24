import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WizardProgress } from "../AppUi";
import { AppText } from "../AppText";
import { FigmaBackButton } from "./FigmaButtons";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { stackScreenTopPadding } from "../../lib/stack-screen-padding";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";

const CREATE_MATCH_SCREEN_X = 20;

export function CreateMatchStepLayout({
  title,
  description,
  step,
  totalSteps,
  onBack,
  children,
  footer,
}: PropsWithChildren<{
  title: string;
  description?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  footer?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          paddingTop: stackScreenTopPadding(insets.top),
          paddingBottom: insets.bottom + 16,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? <FigmaBackButton onPress={onBack} /> : null}
        {step !== undefined && totalSteps !== undefined ? (
          <View style={styles.wizardWrap}>
            <WizardProgress step={step} totalSteps={totalSteps} />
          </View>
        ) : null}
        <View style={styles.header}>
          <View style={tennisTextStyles.titleSubtitleBlock}>
            <AppText accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            {description ? (
              <AppText style={tennisTextStyles.pageSubtitle}>
                {description}
              </AppText>
            ) : null}
          </View>
        </View>
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    scrollContent: {
      paddingHorizontal: CREATE_MATCH_SCREEN_X,
      paddingBottom: 24,
      flexGrow: 1,
      gap: 0,
    },
    wizardWrap: {
      marginTop: 16,
    },
    header: {
      marginTop: 24,
      marginBottom: 20,
    },
    title: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 24,
      lineHeight: 28,
      color: tennisColors.primaryDark,
      letterSpacing: -0.5,
    },
    footer: {
      paddingHorizontal: CREATE_MATCH_SCREEN_X,
      paddingBottom: 8,
      gap: 10,
    },
  }),
);
