import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { OnboardingFormField, onboardingInputStyle } from "../onboarding-ui";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { tennisColors } from "../../theme/tennis-tokens";

type EmailPasswordFields = FieldValues & { email: string; password: string };

export function AuthEmailPasswordFields<T extends EmailPasswordFields>({
  control,
  onSubmitPassword,
}: {
  control: Control<T>;
  onSubmitPassword?: () => void;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Controller
        control={control}
        name={"email" as Path<T>}
        render={({ field, fieldState }) => (
          <OnboardingFormField
            label={t("auth.emailLabel")}
            error={fieldState.error ? t("auth.emailInvalid") : undefined}
          >
            <TextInput
              accessibilityLabel={t("auth.emailLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              style={onboardingInputStyle.input}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={tennisColors.mutedForeground}
            />
          </OnboardingFormField>
        )}
      />
      <Controller
        control={control}
        name={"password" as Path<T>}
        render={({ field, fieldState }) => (
          <OnboardingFormField
            label={t("auth.passwordLabel")}
            error={fieldState.error ? t("auth.passwordInvalid") : undefined}
          >
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabel={t("auth.passwordLabel")}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={onSubmitPassword}
                style={[onboardingInputStyle.input, styles.passwordInput]}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={tennisColors.mutedForeground}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                onPress={() => setShowPassword((value) => !value)}
                style={styles.toggle}
              >
                <AppText style={styles.toggleLabel}>
                  {showPassword
                    ? t("auth.hidePassword")
                    : t("auth.showPassword")}
                </AppText>
              </Pressable>
            </View>
          </OnboardingFormField>
        )}
      />
    </>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    passwordRow: {
      position: "relative",
    },
    passwordInput: {
      paddingRight: 72,
    },
    toggle: {
      position: "absolute",
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: "center",
    },
    toggleLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primary,
    },
  }),
);
