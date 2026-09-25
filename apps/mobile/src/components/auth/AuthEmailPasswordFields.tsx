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
import { minTouchTargetPx } from "@tennis-lebanon/ui";
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
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
              onBlur={() => {
                field.onBlur();
                setEmailFocused(false);
              }}
              onFocus={() => setEmailFocused(true)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              style={[
                onboardingInputStyle.input,
                emailFocused ? onboardingInputStyle.inputFocused : null,
                fieldState.error ? onboardingInputStyle.inputError : null,
              ]}
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
                onBlur={() => {
                  field.onBlur();
                  setPasswordFocused(false);
                }}
                onFocus={() => setPasswordFocused(true)}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={onSubmitPassword}
                style={[
                  onboardingInputStyle.input,
                  styles.passwordInput,
                  passwordFocused ? onboardingInputStyle.inputFocused : null,
                  fieldState.error ? onboardingInputStyle.inputError : null,
                ]}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={tennisColors.mutedForeground}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={8}
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
      paddingRight: 70,
    },
    toggle: {
      position: "absolute",
      right: 12,
      top: 0,
      bottom: 0,
      minWidth: minTouchTargetPx,
      justifyContent: "center",
      alignItems: "flex-end",
    },
    toggleLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12.5,
      color: tennisColors.linkText,
    },
  }),
);
