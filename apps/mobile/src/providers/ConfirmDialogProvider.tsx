import { useTranslation } from "react-i18next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/AppText";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../components/onboarding-ui";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import { useLayoutDirection } from "../lib/layout-direction";
import {
  registerConfirmPresenters,
  type ChooseActionOptions,
  type CancelMatchDialogOptions,
} from "../lib/confirm-action";
import { CancelMatchDialogPanel } from "./CancelMatchDialogPanel";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";

type NotifyState = {
  kind: "notify";
  title: string;
  message?: string;
};

type ChooseState = {
  kind: "choose";
  options: ChooseActionOptions;
};

type CancelMatchState = {
  kind: "cancelMatch";
  options: CancelMatchDialogOptions;
};

type DialogState = NotifyState | ChooseState | CancelMatchState | null;

const ConfirmDialogContext = createContext<{ visible: boolean } | null>(null);

export function useConfirmDialogVisible(): boolean {
  const ctx = useContext(ConfirmDialogContext);
  return ctx?.visible ?? false;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const [dialog, setDialog] = useState<DialogState>(null);

  const close = useCallback(() => setDialog(null), []);

  const presentNotify = useCallback((title: string, message?: string) => {
    setDialog({ kind: "notify", title, message });
  }, []);

  const presentChoose = useCallback((options: ChooseActionOptions) => {
    setDialog({ kind: "choose", options });
  }, []);

  const presentCancelMatch = useCallback((options: CancelMatchDialogOptions) => {
    setDialog({ kind: "cancelMatch", options });
  }, []);

  useEffect(() => {
    registerConfirmPresenters({
      notify: presentNotify,
      chooseAction: presentChoose,
      cancelMatchDialog: presentCancelMatch,
    });
    return () => registerConfirmPresenters(null);
  }, [presentCancelMatch, presentChoose, presentNotify]);

  const value = useMemo(
    () => ({ visible: dialog !== null }),
    [dialog],
  );

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Modal
        animationType="fade"
        transparent
        visible={dialog !== null}
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.card,
              {
                marginTop: insets.top + 24,
                marginBottom: insets.bottom + 24,
              },
            ]}
          >
            {dialog?.kind === "notify" ? (
              <>
                <AppText
                  accessibilityRole="header"
                  style={[styles.title, { writingDirection }]}
                >
                  {dialog.title}
                </AppText>
                {dialog.message ? (
                  <AppText
                    style={[styles.message, { writingDirection }]}
                    maxLines={6}
                  >
                    {dialog.message}
                  </AppText>
                ) : null}
                <FigmaPrimaryButton
                  label={t("common.done")}
                  onPress={close}
                  style={styles.singleAction}
                />
              </>
            ) : null}

            {dialog?.kind === "choose" ? (
              <>
                <AppText
                  accessibilityRole="header"
                  style={[styles.title, { writingDirection }]}
                >
                  {dialog.options.title}
                </AppText>
                <AppText
                  style={[styles.message, { writingDirection }]}
                  maxLines={6}
                >
                  {dialog.options.message}
                </AppText>
                <View style={styles.actions}>
                  <FigmaPrimaryButton
                    label={dialog.options.confirmLabel}
                    onPress={() => {
                      const { onConfirm } = dialog.options;
                      close();
                      onConfirm();
                    }}
                  />
                  <FigmaSecondaryButton
                    label={dialog.options.cancelLabel}
                    onPress={() => {
                      const { onCancel } = dialog.options;
                      close();
                      onCancel?.();
                    }}
                  />
                </View>
              </>
            ) : null}

            {dialog?.kind === "cancelMatch" ? (
              <CancelMatchDialogPanel
                options={dialog.options}
                writingDirection={writingDirection}
                onClose={close}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 28, 20, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 12,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 17,
    lineHeight: 22,
    color: tennisColors.primaryDark,
    letterSpacing: -0.3,
  },
  message: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: tennisColors.mutedForeground,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  singleAction: {
    marginTop: 4,
  },
});
