import React from "react";
import { useReducedMotion } from "./TaskTabs";
import { selectionFeedback } from "../platform/haptics";
import { View, Text, Pressable } from "react-native";
import { dayKey, localDate } from "../domain/model";
import { DateField } from "./DateField";
import { s } from "./styles";
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        {
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !reduced ? 0.98 : 1 }],
        },
      ]}
    >
      <Text style={secondary ? s.secondaryText : s.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function Timestamp({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const d = value ? new Date(value) : undefined;
  return (
    <View>
      <DateField
        label={label}
        value={d ? dayKey(d) : undefined}
        onChange={(day) =>
          onChange(
            day
              ? localDate(
                  day,
                  d
                    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                    : "18:00",
                ).toISOString()
              : undefined,
          )
        }
      />
      {d && (
        <DateField
          label="Hatırlatma saati"
          time
          value={`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`}
          onChange={(time) =>
            onChange(
              time ? localDate(dayKey(d), time).toISOString() : undefined,
            )
          }
        />
      )}
    </View>
  );
}

export { Sheet } from "./Sheet";
