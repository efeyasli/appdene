import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Task, dateLabel, localDate } from "../domain/model";
import { Tab, futureDate, status } from "../domain/selectors";
import { CompletionControl } from "./CompletionControl";
import { s } from "./styles";

export type RowActions = {
  open: (t: Task) => void;
  complete: (t: Task) => Promise<boolean>;
  toggleImportant: (t: Task) => void;
};

// Memoized so typing in the composer or a 30 s clock tick does not re-render
// every task: a row only changes when its task, the day or the page changes.
export const TaskRow = memo(function TaskRow({
  task: t,
  today,
  page,
  reduced,
  actions,
}: {
  task: Task;
  today: string;
  page?: Tab;
  reduced: boolean;
  actions: RowActions;
}) {
  const day = localDate(today, "12:00");
  const meta =
    [
      status(t, day),
      t.dueDate
        ? `Teslim: ${dateLabel(t.dueDate)}${t.dueTime ? " " + t.dueTime : ""}`
        : "",
      t.plannedDate ? `Çalışma: ${dateLabel(t.plannedDate)}` : "",
      t.reminderAt
        ? `Hatırlatma: ${new Date(t.reminderAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Tarihsiz";
  return (
    <View style={s.row}>
      <CompletionControl
        completed={!!t.completedAt}
        label={`${t.title} ${t.completedAt ? "yeniden aç" : "tamamla"}`}
        reduced={reduced}
        onComplete={() => actions.complete(t)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ayrıntıları düzenle`}
        onPress={() => actions.open(t)}
        style={({ pressed }) => [
          s.rowBody,
          pressed && { backgroundColor: "#F4F0FF" },
        ]}
      >
        <Text
          style={[
            s.taskTitle,
            t.completedAt && {
              textDecorationLine: "line-through",
              color: "#7065AC",
            },
          ]}
        >
          {t.title}
        </Text>
        <Text style={s.meta}>{meta}</Text>
        {page === "Yaklaşan" && (
          <Text style={s.meta}>
            Sıradaki tarih: {dateLabel(futureDate(t, today))}
          </Text>
        )}
      </Pressable>
      <Pressable
        accessibilityLabel={t.important ? "Önemi kaldır" : "Önemli işaretle"}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => actions.toggleImportant(t)}
        style={({ pressed }) => [
          s.check,
          {
            opacity: pressed ? 0.5 : 1,
            transform: [{ scale: pressed && !reduced ? 0.88 : 1 }],
          },
        ]}
      >
        <Text
          style={{ fontSize: 24, color: t.important ? "#D0A320" : "#7065AC" }}
        >
          {t.important ? "★" : "☆"}
        </Text>
      </Pressable>
    </View>
  );
});
