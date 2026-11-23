import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { dayKey, localDate, dateLabel, addDays } from "../domain/model";
import { calendarDays } from "../domain/reminder";
import { Sheet } from "./Sheet";
import { selectionFeedback } from "../platform/haptics";
import { s } from "./styles";
import { c, f } from "./theme";
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
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(""),
    [month, setMonth] = useState(dayKey(new Date()));
  const date = time
    ? localDate(dayKey(new Date()), draft || "18:00")
    : localDate(draft || dayKey(new Date()));
  const action = (title: string, fn: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        selectionFeedback();
        fn();
      }}
      style={({ pressed }) => [
        primary ? s.button : s.secondary,
        {
          minHeight: 44,
          padding: 12,
          borderRadius: 14,
          alignItems: "center",
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={primary ? s.buttonText : s.secondaryText}>{title}</Text>
    </Pressable>
  );
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? (time ? value : dateLabel(value)) : "Belirtilmedi"}`}
        onPress={() => {
          setDraft(value || (time ? "18:00" : dayKey(new Date())));
          setMonth(value && !time ? value : dayKey(new Date()));
          setOpen(true);
        }}
        style={({ pressed }) => [s.fieldRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.taskTitle}>{label}</Text>
          <Text style={s.meta}>
            {value ? (time ? value : dateLabel(value)) : "Belirtilmedi"}
          </Text>
        </View>
        <Text style={{ fontSize: 24, color: c.slate }}>›</Text>
      </Pressable>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          {!time && (
            <>
              <View style={s.actions}>
                {[
                  ["Bugün", 0],
                  ["Yarın", 1],
                  ["Haftaya", 7],
                ].map(([title, n]) => (
                  <View key={title} style={{ flex: 1 }}>
                    {action(String(title), () => {
                      const d = dayKey(addDays(new Date(), Number(n)));
                      setDraft(d);
                      setMonth(d);
                    })}
                  </View>
                ))}
              </View>
              <View style={s.calendarHeader}>
                {action("‹", () => {
                  const d = localDate(month.slice(0, 7) + "-01");
                  d.setMonth(d.getMonth() - 1);
                  setMonth(dayKey(d));
                })}
                <Text style={s.h2}>
                  {localDate(month).toLocaleDateString("tr-TR", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                {action("›", () => {
                  const d = localDate(month.slice(0, 7) + "-01");
                  d.setMonth(d.getMonth() + 1);
                  setMonth(dayKey(d));
                })}
              </View>
              <View style={{ flexDirection: "row" }}>
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                  <Text
                    key={d}
                    style={[s.meta, { width: "14.2857%", textAlign: "center" }]}
                  >
                    {d}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {calendarDays(month).map((d) => (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={dateLabel(d)}
                    accessibilityState={{ selected: d === draft }}
                    onPress={() => {
                      selectionFeedback();
                      setDraft(d);
                    }}
                    style={{
                      width: "14.2857%",
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 22,
                      backgroundColor: d === draft ? c.blue : "transparent",
                      borderWidth: d === dayKey(new Date()) ? 1 : 0,
                      borderColor: c.blue,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: f.semibold,
                        color:
                          d === draft
                            ? c.white
                            : d.slice(0, 7) === month.slice(0, 7)
                              ? c.navy
                              : c.slate,
                      }}
                    >
                      {Number(d.slice(-2))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {time && (
            <DateTimePicker
              value={date}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              locale="tr-TR"
              is24Hour
              textColor={c.navy}
              onChange={(event, d) => {
                if (event.type === "set" && d)
                  setDraft(
                    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
                  );
                if (Platform.OS !== "ios" && event.type === "dismissed")
                  setOpen(false);
              }}
            />
          )}
          <Text
            style={[
              s.inset,
              {
                textAlign: "center",
                fontSize: 18,
                color: c.navy,
                fontFamily: f.bold,
              },
            ]}
          >
            {time ? draft : dateLabel(draft)}
          </Text>
          {action(
            time ? "Saati seç" : "Tarihi seç",
            () => {
              onChange(draft);
              setOpen(false);
            },
            true,
          )}
          {clearable &&
            action(time ? "Saati kaldır" : "Tarihi kaldır", () => {
              onChange(undefined);
              setOpen(false);
            })}
        </Sheet>
      )}
    </View>
  );
}
