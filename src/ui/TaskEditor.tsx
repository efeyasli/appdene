import React from "react";
import { Text, TextInput, View, Switch } from "react-native";
import {
  State,
  Task,
  dayKey,
  addDays,
  localDate,
  defaultReminder,
} from "../domain/model";
import { Button, Sheet } from "./Controls";
import { DateField } from "./DateField";
import { ReminderField } from "./ReminderField";
import { s } from "./styles";
type Props = {
  task: Task;
  setTask: (t: Task | null) => void;
  error: string;
  busy: boolean;
  now: Date;
  state: State;
  patch: (t: Task) => Promise<boolean>;
  complete: (t: Task) => Promise<boolean>;
  remove: (t: Task) => Promise<void>;
  setNotice: (s: string) => void;
};
export function TaskEditor({
  task,
  setTask,
  error,
  busy,
  now,
  state,
  patch,
  complete,
  remove,
  setNotice,
}: Props) {
  return (
    <Sheet title="Görev ayrıntısı" onClose={() => setTask(null)}>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#A02F28" }}>
          {error}
        </Text>
      )}
      <Text style={s.meta}>Başlık</Text>
      <TextInput
        accessibilityLabel="Görev başlığı"
        value={task.title}
        onChangeText={(title) => setTask({ ...task, title })}
        multiline
        style={s.editInput}
      />
      <Text style={s.meta}>İlk giriş: {task.originalText}</Text>
      <View style={[s.setting, s.inset]}>
        <Text style={s.taskTitle}>★ Önemli</Text>
        <Switch
          accessibilityLabel="Önemli"
          trackColor={{ true: "#5D47D9" }}
          value={task.important}
          onValueChange={(important) => setTask({ ...task, important })}
        />
      </View>
      <DateField
        label="Teslim tarihi"
        value={task.dueDate}
        onChange={(dueDate) =>
          setTask({
            ...task,
            dueDate,
            dueTime: dueDate ? task.dueTime : undefined,
          })
        }
      />
      {task.dueDate && (
        <DateField
          label="Teslim saati (isteğe bağlı)"
          time
          value={task.dueTime}
          onChange={(dueTime) => setTask({ ...task, dueTime })}
        />
      )}
      <DateField
        label="Planlanan çalışma günü"
        value={task.plannedDate}
        onChange={(plannedDate) => setTask({ ...task, plannedDate })}
      />
      <Button
        secondary
        label={
          task.plannedDate === dayKey(now)
            ? "Bugün planını kaldır"
            : "Bugün çalış"
        }
        onPress={() =>
          setTask({
            ...task,
            plannedDate:
              task.plannedDate === dayKey(now) ? undefined : dayKey(now),
          })
        }
      />
      <ReminderField
        dueDate={task.dueDate}
        value={task.reminderAt}
        onChange={(reminderAt) =>
          setTask({ ...task, reminderAt, snoozedUntil: undefined })
        }
      />
      <Button
        secondary
        label="Teslime göre varsayılan hatırlatma"
        onPress={() =>
          setTask({
            ...task,
            reminderAt: defaultReminder(
              task.dueDate,
              task.dueTime,
              state.settings,
              new Date(),
            ),
            snoozedUntil: undefined,
          })
        }
      />
      <Button
        secondary
        label={`Yarına ertele · ${state.settings.summaryTime}`}
        onPress={() => {
          const at = localDate(
            dayKey(addDays(new Date(), 1)),
            state.settings.summaryTime,
          ).toISOString();
          setTask({ ...task, reminderAt: at, snoozedUntil: at });
        }}
      />
      {task.reminderAt && new Date(task.reminderAt) <= now && (
        <Text style={s.meta}>
          Hatırlatma geçmişte; bildirim kurulmayacak. Yeni bir zaman seç.
        </Text>
      )}
      <View style={s.actions}>
        <Button
          label="Kaydet"
          disabled={busy || !task.title.trim()}
          onPress={() =>
            void (async () => {
              if (await patch({ ...task, title: task.title.trim() })) {
                setTask(null);
                setNotice("Güncellendi");
              }
            })()
          }
        />
        <Button
          secondary
          label={task.completedAt ? "Yeniden aç" : "Tamamla"}
          onPress={() =>
            void (async () => {
              if (await complete(task)) setTask(null);
            })()
          }
        />
        <Button secondary label="Sil" onPress={() => void remove(task)} />
      </View>
    </Sheet>
  );
}
