import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type View as RNView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import {
  COMPLETED_TIME_FILTERS,
  completedTimeFilterTabKey,
  type CompletedTimeFilter,
} from "../../lib/completed-match-time-filter";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

type MenuAnchor = {
  x: number;
  y: number;
  width: number;
};

export function CompletedTimeFilterControl({
  value,
  onChange,
}: {
  value: CompletedTimeFilter;
  onChange: (next: CompletedTimeFilter) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const triggerRef = useRef<RNView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  function close() {
    setOpen(false);
    setAnchor(null);
  }

  function toggle() {
    if (open) {
      close();
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y: y + height - 1.5, width });
      setOpen(true);
    });
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("matches.list.completedFilterLabel")}
          accessibilityHint={t(completedTimeFilterTabKey(value))}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={({ pressed }) => [
            styles.trigger,
            open && styles.triggerOpen,
            { flexDirection: rowDirection },
            pressed && styles.triggerPressed,
          ]}
        >
          <AppText style={styles.triggerLabel} maxLines={1}>
            {t(completedTimeFilterTabKey(value))}
          </AppText>
          <View style={open ? styles.chevronOpen : undefined}>
            <Icon name="chevronDown" size={16} color={tennisColors.primary} />
          </View>
        </Pressable>
      </View>

      <Modal
        transparent
        animationType="none"
        visible={open && anchor != null}
        onRequestClose={close}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          {anchor ? (
            <View
              style={[
                styles.menu,
                {
                  top: anchor.y,
                  left: anchor.x,
                  width: anchor.width,
                },
              ]}
              accessibilityRole="menu"
            >
              {COMPLETED_TIME_FILTERS.map((filter) => {
                const selected = value === filter;
                return (
                  <Pressable
                    key={filter}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(completedTimeFilterTabKey(filter))}
                    onPress={() => {
                      onChange(filter);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      { flexDirection: rowDirection },
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                      ]}
                      maxLines={1}
                    >
                      {t(completedTimeFilterTabKey(filter))}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.card,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
  },
  triggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  triggerPressed: {
    opacity: 0.88,
  },
  triggerLabel: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
    textAlign: "center",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  modalRoot: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    borderBottomLeftRadius: tennisRadii.lg,
    borderBottomRightRadius: tennisRadii.lg,
    backgroundColor: tennisColors.card,
    overflow: "hidden",
    shadowColor: "#0D1117",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  option: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tennisColors.border,
  },
  optionSelected: {
    backgroundColor: tennisColors.secondary,
  },
  optionPressed: {
    opacity: 0.88,
  },
  optionLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.primaryDark,
    textAlign: "center",
  },
  optionLabelSelected: {
    fontFamily: tennisFontFamily.bodySemi,
    color: tennisColors.primary,
  },
});
