import React, { useState } from "react";
import { View, Text, Pressable, Switch, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { dayKey, localDate } from "../domain/model";
import { reminderDays, reminderFromOffset } from "../domain/reminder";
import { Sheet } from "./Sheet";
import { Button, Timestamp } from "./Controls";
import { selectionFeedback } from "../platform/haptics";
import { s } from "./styles";
export function ReminderField({
  dueDate,
  value,
  onChange,
}: {
  dueDate?: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(1),
    [time, setTime] = useState("18:00"),
    [enabled, setEnabled] = useState(true),
    [custom, setCustom] = useState<string | undefined>(),
    [customMode, setCustomMode] = useState(false);
  const at =
    dueDate && !customMode
      ? reminderFromOffset(dueDate, reminderDays[index], time)
      : custom;
  function choose(n: number) {
    if (n !== index) selectionFeedback();
    setIndex(n);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const d = value ? new Date(value) : undefined;
          setTime(
            d
              ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
              : "18:00",
          );
          setIndex(
            d && dueDate
              ? Math.max(
                  0,
                  reminderDays.findIndex(
                    (n) =>
                      dayKey(
                        new Date(reminderFromOffset(dueDate, n, "12:00")),
                      ) === dayKey(d),
                  ),
                )
              : 1,
          );
          const matched =
            d && dueDate
              ? reminderDays.findIndex(
                  (n) =>
                    dayKey(
                      new Date(reminderFromOffset(dueDate, n, "12:00")),
                    ) === dayKey(d),
                )
              : -1;
          setCustomMode(!!value && matched < 0);
          setCustom(value);
          setEnabled(!!value);
          setOpen(true);
        }}
        style={s.fieldRow}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.taskTitle}>Hatırlatma</Text>
          <Text style={s.meta}>
            {value ? new Date(value).toLocaleString("tr-TR") : "Belirtilmedi"}
          </Text>
        </View>
        <Text style={s.meta}>›</Text>
      </Pressable>
      {open && (
        <Sheet title="Hatırlatma" onClose={() => setOpen(false)}>
          <View style={[s.inset, s.setting]}>
            <Text style={s.taskTitle}>Hatırlat</Text>
            <Switch
              accessibilityLabel="Hatırlat"
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: "#5D47D9" }}
            />
          </View>
          {enabled && (
            <>
              {dueDate && !customMode ? (
                <>
                  <View style={s.inset}>
                    <View style={s.setting}>
                      <Text style={s.taskTitle}>Ne kadar önce?</Text>
                      <Text style={s.taskTitle}>
                        {index === 0
                          ? "Aynı gün"
                          : `${reminderDays[index]} gün önce`}
                      </Text>
                    </View>
                    <Slider
                      accessibilityLabel="Kaç gün önce hatırlatılsın"
                      minimumValue={0}
                      maximumValue={4}
                      step={1}
                      value={index}
                      onValueChange={choose}
                      minimumTrackTintColor="#5D47D9"
                      maximumTrackTintColor="#C7BDEB"
                      thumbTintColor="#5D47D9"
                      style={{ height: 44 }}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      {reminderDays.map((n, i) => (
                        <Pressable
                          key={n}
                          accessibilityRole="button"
                          accessibilityState={{ selected: index === i }}
                          onPress={() => choose(i)}
                          style={{
                            minHeight: 44,
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 12, color: "#18105B" }}>
                            {n === 0 ? "Aynı gün" : `${n} gün`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <Text style={s.taskTitle}>Hatırlatma saati</Text>
                  <DateTimePicker
                    mode="time"
                    value={localDate(dayKey(new Date()), time)}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    locale="tr-TR"
                    is24Hour
                    textColor="#18105B"
                    onChange={(e, d) => {
                      if (e.type === "set" && d)
                        setTime(
                          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
                        );
                    }}
                  />
                </>
              ) : (
                <Timestamp
                  label="Hatırlatma tarihi"
                  value={custom}
                  onChange={setCustom}
                />
              )}
              {dueDate && (
                <Button
                  secondary
                  label={customMode ? "Teslime göre seç" : "Özel tarih ve saat"}
                  onPress={() => {
                    setCustom(at);
                    setCustomMode(!customMode);
                  }}
                />
              )}
              <Text
                accessibilityLiveRegion="polite"
                style={[s.inset, s.taskTitle]}
              >
                {at
                  ? new Date(at).toLocaleString("tr-TR")
                  : "Bir hatırlatma tarihi seç"}
              </Text>
              {at && new Date(at) <= new Date() && (
                <Text style={{ color: "#A02F28" }}>
                  Bu zaman geçmişte; gelecekte bir zaman seç.
                </Text>
              )}
            </>
          )}
          <Button
            label="Hatırlatmayı kaydet"
            disabled={enabled && (!at || new Date(at) <= new Date())}
            onPress={() => {
              onChange(enabled ? at : undefined);
              setOpen(false);
            }}
          />
          <Button
            label="Hatırlatmayı kaldır"
            secondary
            onPress={() => {
              onChange(undefined);
              setOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
