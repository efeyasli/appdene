import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { dayKey, localDate, dateLabel } from "../domain/model";
export function DateField({
  label,
  value,
  time = false,
  clearable = true,
  onChange,
}: {
  label: string;
  value?: string;
  time?: boolean;
  clearable?: boolean;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = time
    ? localDate(dayKey(new Date()), value || "09:00")
    : value
      ? localDate(value)
      : new Date();
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={{ color: "#667085", marginBottom: 4 }}>{label}</Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!open && !value) onChange(time ? "09:00" : dayKey(new Date()));
            setOpen(!open);
          }}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 10,
            backgroundColor: "#EDF4FF",
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#2459BF" }}>
            {value ? (time ? value : dateLabel(value)) : "Seç"}
          </Text>
        </Pressable>
        {value && clearable && (
          <Pressable
            accessibilityLabel={`${label} kaldır`}
            onPress={() => onChange(undefined)}
            style={{ padding: 12, minHeight: 44 }}
          >
            <Text>Kaldır</Text>
          </Pressable>
        )}
      </View>
      {open && (
        <>
          <DateTimePicker
            value={date}
            mode={time ? "time" : "date"}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale="tr-TR"
            onChange={(event, d) => {
              if (Platform.OS !== "ios") setOpen(false);
              if (event.type === "set" && d)
                onChange(
                  time
                    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
                    : dayKey(d),
                );
            }}
          />
          {Platform.OS === "ios" && (
            <Pressable onPress={() => setOpen(false)} style={{ padding: 12 }}>
              <Text style={{ color: "#2459BF" }}>Bitti</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}
