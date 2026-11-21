import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Task, dayKey, dateLabel } from "../domain/model";
import { Button } from "./Controls";
import { selectionFeedback } from "../platform/haptics";
import { s } from "./styles";
export function AttentionCarousel({
  tasks,
  now,
  onOpen,
  onToday,
  onSnooze,
  reduced,
}: {
  tasks: Task[];
  now: Date;
  onOpen: (t: Task) => void;
  onToday: (t: Task) => void;
  onSnooze: (t: Task) => void;
  reduced: boolean;
}) {
  const [width, setWidth] = useState(0),
    [active, setActive] = useState(0),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const identity = tasks.map((t) => t.id).join("|");
  useEffect(() => {
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [identity, width]);
  // Reset the dot without rendering a stale page after task completion/snooze.
  const [last, setLast] = useState(identity);
  if (identity !== last) {
    setLast(identity);
    setActive(0);
  }
  if (!tasks.length) return null;
  const step = width * 0.94;
  function remaining(day: string) {
    const n = Math.round(
      (Date.parse(day + "T00:00:00Z") -
        Date.parse(dayKey(now) + "T00:00:00Z")) /
        86400000,
    );
    return n < 0 ? "Gecikmiş" : n === 0 ? "Bugün" : `${n} gün kaldı`;
  }
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 18 }}
    >
      <ScrollView
        ref={scroll}
        horizontal
        snapToInterval={step || 1}
        decelerationRate="fast"
        disableIntervalMomentum
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: width * 0.06 }}
        // The dot follows the card under the finger, with one haptic tick per card.
        scrollEventThrottle={32}
        onScroll={(e) => {
          if (!step) return;
          const i = Math.min(
            tasks.length - 1,
            Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)),
          );
          if (i !== active) {
            setActive(i);
            selectionFeedback();
          }
        }}
      >
        {width > 0 &&
          tasks.map((t, i) => (
            <View
              key={t.id}
              style={[s.attentionCard, { width: step - 10, marginRight: 10 }]}
              accessibilityElementsHidden={i !== active}
            >
              <Text
                style={{ color: "#5D47D9", fontSize: 14, fontWeight: "600" }}
              >
                ★ Önemli & yaklaşan
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpen(t)}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={s.taskTitle} numberOfLines={2}>
                  {t.title}
                </Text>
                {t.dueDate && (
                  <Text
                    style={{
                      color: "#5D47D9",
                      fontWeight: "600",
                      marginTop: 4,
                    }}
                  >
                    {remaining(t.dueDate)}
                  </Text>
                )}
                <Text style={s.meta}>
                  {t.dueDate
                    ? `Teslim: ${dateLabel(t.dueDate)}`
                    : "Önemli · tarihsiz"}
                </Text>
              </Pressable>
              <View style={s.actions}>
                {t.plannedDate !== dayKey(now) && (
                  <Button label="Bugüne ekle" onPress={() => onToday(t)} />
                )}
                <Button
                  label="Yarın hatırlat"
                  secondary
                  onPress={() => onSnooze(t)}
                />
              </View>
            </View>
          ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: 4,
        }}
      >
        {tasks.map((t, i) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. önemli görev`}
            accessibilityState={{ selected: i === active }}
            onPress={() => {
              if (i !== active) selectionFeedback();
              setActive(i);
              scroll.current?.scrollTo({ x: i * step, animated: !reduced });
            }}
            style={{
              width: 44,
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === active ? "white" : "#A99DDE",
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
