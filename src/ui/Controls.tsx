import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text
        style={{ color: secondary ? "#2459BF" : "white", fontWeight: "600" }}
      >
        {label}
      </Text>
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
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.sheetHeader}>
            <Text accessibilityRole="header" style={s.h2}>
              {title}
            </Text>
            <Button label="Kapat" secondary onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetBody}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
