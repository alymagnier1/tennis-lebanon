import type { PropsWithChildren, ReactNode, RefObject } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollView as ScrollViewType,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { KeyboardAvoider } from "../KeyboardAvoider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { FigmaBackButton } from "./FigmaButtons";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { useTranslation } from "react-i18next";

export type AuthFormMarksKind = "signup" | "signin" | "quiet";

export function OnboardingProgressBar({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: totalSteps, now: step }}
      style={styles.progress}
    >
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            index < step ? styles.progressSegmentFilled : null,
          ]}
        />
      ))}
    </View>
  );
}

function AuthFormMarks({ kind }: { kind: AuthFormMarksKind }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.markCircle} />
      {kind === "signup" ? <View style={styles.markRule} /> : null}
    </View>
  );
}

export function OnboardingStepLayout({
  title,
  description,
  step,
  totalSteps,
  onBack,
  backAccessibilityLabel,
  children,
  footer,
  scroll = true,
  scrollRef,
  avoidKeyboard = true,
  marks,
}: PropsWithChildren<{
  title: string;
  description?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  footer?: ReactNode;
  scroll?: boolean;
  scrollRef?: RefObject<ScrollViewType | null>;
  /**
   * Auth credential screens keep the action stack in the scroll and turn this
   * off so focusing email does not lift the buttons above the keyboard.
   */
  avoidKeyboard?: boolean;
  marks?: AuthFormMarksKind;
}>) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const hasSteps = Boolean(step && totalSteps);

  const body = (
    <>
      {onBack ? (
        <View style={hasSteps ? styles.backOnboarding : styles.backAuth}>
          <FigmaBackButton
            onPress={onBack}
            accessibilityLabel={backAccessibilityLabel}
          />
        </View>
      ) : null}
      {hasSteps && step && totalSteps ? (
        <>
          <OnboardingProgressBar step={step} totalSteps={totalSteps} />
          <AppText style={[tennisTextStyles.eyebrow, styles.eyebrow]}>
            {t("onboarding.stepEyebrow", { step, total: totalSteps })}
          </AppText>
        </>
      ) : null}
      <View>
        <AppText
          accessibilityRole="header"
          style={[tennisTextStyles.screenTitle, styles.title]}
        >
          {title}
        </AppText>
        {description ? (
          <AppText style={[tennisTextStyles.bodyForm, styles.subtitle]}>
            {description}
          </AppText>
        ) : null}
      </View>
      {children}
    </>
  );

  const frameStyle = [
    styles.root,
    {
      paddingTop: insets.top + 36,
      paddingBottom: insets.bottom + 30,
    },
  ];
  const content = (
    <>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={styles.scrollContent}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  return (
    <View style={frameStyle}>
      {marks ? <AuthFormMarks kind={marks} /> : null}
      {avoidKeyboard ? (
        <KeyboardAvoider style={styles.flex}>{content}</KeyboardAvoider>
      ) : (
        <View style={styles.flex}>{content}</View>
      )}
    </View>
  );
}

export function OnboardingFormField({
  label,
  error,
  children,
}: PropsWithChildren<{ label: string; error?: string }>) {
  return (
    <View style={styles.field}>
      <AppText style={tennisTextStyles.fieldLabel}>{label}</AppText>
      {children}
      {error ? <AppText style={styles.fieldError}>{error}</AppText> : null}
    </View>
  );
}

export const onboardingInputStyle = createLiveSheet(() =>
  StyleSheet.create({
    input: {
      borderWidth: 1.5,
      borderColor: tennisColors.border,
      borderRadius: 12,
      backgroundColor: tennisColors.card,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      color: tennisColors.heroOnLight,
    },
    inputFocused: {
      borderColor: tennisColors.heroGreen,
    },
    inputError: {
      borderColor: tennisColors.danger,
    },
  }),
);

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: tennisColors.background,
      overflow: "hidden",
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: tennisSpacing.screenX,
      paddingBottom: 24,
      flexGrow: 1,
    },
    backAuth: {
      marginBottom: 26,
    },
    backOnboarding: {
      marginBottom: 22,
    },
    progress: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 20,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: tennisColors.secondary,
    },
    progressSegmentFilled: {
      backgroundColor: tennisColors.heroGreen,
    },
    eyebrow: {
      marginBottom: 8,
    },
    title: {
      marginBottom: 6,
    },
    subtitle: {
      marginBottom: 22,
    },
    footer: {
      paddingHorizontal: tennisSpacing.screenX,
      paddingBottom: 8,
      gap: 10,
    },
    field: {
      marginBottom: 18,
    },
    fieldError: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.danger,
      marginTop: 6,
    },
    markCircle: {
      position: "absolute",
      width: 300,
      height: 300,
      borderRadius: 150,
      borderWidth: 2,
      borderColor: tennisColors.heroGreen,
      opacity: 0.05,
      right: -70,
      bottom: -40,
    },
    markRule: {
      position: "absolute",
      width: 420,
      height: 2,
      backgroundColor: tennisColors.heroGreen,
      opacity: 0.05,
      left: -40,
      bottom: 120,
      transform: [{ rotate: "-14deg" }],
    },
  }),
);
