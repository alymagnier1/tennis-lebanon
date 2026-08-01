import { Pressable, View } from "react-native";
import { AppText } from "../AppText";
import { useLayoutDirection } from "../../lib/layout-direction";
import { figmaFormStyles } from "./figma-form-styles";

export function FigmaChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={figmaFormStyles.chipRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              figmaFormStyles.chip,
              selected && figmaFormStyles.chipSelected,
            ]}
          >
            <AppText
              style={[
                figmaFormStyles.chipText,
                selected && figmaFormStyles.chipTextSelected,
                { writingDirection },
              ]}
              maxLines={2}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FigmaChipMulti({
  options,
  values,
  onToggle,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={figmaFormStyles.chipWrap}>
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onToggle(option.value)}
            style={[
              figmaFormStyles.chipWrapItem,
              selected && figmaFormStyles.chipSelected,
            ]}
          >
            <AppText
              style={[
                figmaFormStyles.chipText,
                selected && figmaFormStyles.chipTextSelected,
                { writingDirection },
              ]}
              maxLines={2}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
