import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  State,
  Task,
  emptyState,
  createTask,
  dayKey,
  addDays,
  localDate,
  dateLabel,
  defaultReminder,
} from "./src/domain/model";
import { parseTurkish } from "./src/domain/parse";
import {
  attention,
  list,
  status,
  Tab,
  futureDate,
} from "./src/domain/selectors";
import { notificationPlan, reconcile } from "./src/domain/notifications";
import { Repository } from "./src/data/repository";
import { openRepository } from "./src/data/sqlite";
import { allowed, driver } from "./src/platform/notifications";
import { DateField } from "./src/ui/DateField";
import { Button, Timestamp } from "./src/ui/Controls";
import { s } from "./src/ui/styles";
import { TaskEditor } from "./src/ui/TaskEditor";
import { SettingsScreen } from "./src/ui/SettingsScreen";
import {
  TaskTabs,
  TaskListTransition,
  useReducedMotion,
} from "./src/ui/TaskTabs";
const blue = "#356FE5";
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Main />
    </SafeAreaProvider>
  );
}
function Main() {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<State>(emptyState),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(new Date());
  const repository = useRef<Repository | null>(null),
    current = useRef(state),
    locked = useRef(false);
  const [text, setText] = useState(""),
    [tab, setTab] = useState<Tab>("Bugün"),
    [quick, setQuick] = useState(false),
    [override, setOverride] = useState<{
      dueDate?: string;
      dueTime?: string;
      reminderAt?: string;
    } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null),
    [settings, setSettings] = useState(false),
    [permission, setPermission] = useState(false),
    [showDone, setShowDone] = useState(false),
    [undo, setUndo] = useState<Task | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  async function sync(value: State) {
    try {
      const result = await reconcile(driver, value, new Date());
      setPermission(await allowed());
      if (result.denied)
        setError(
          "Bildirim izni yok. Görev kaydedildi; bildirim için Ayarlar’ı aç.",
        );
      else if (result.overflow)
        setError(
          `${result.overflow} hatırlatma kapasite dışında. En yakın 50 bildirim kuruldu; uygulamayı açınca takvim yenilenir.`,
        );
    } catch {
      setError(
        "Veriler cihazda kayıtlı; bildirimler güncellenemedi. Ayarlardan yeniden dene.",
      );
    }
  }
  async function load() {
    if (locked.current) return;
    locked.current = true;
    try {
      const repo = await openRepository();
      repository.current = repo;
      const value = await repo.load();
      current.current = value;
      setState(value);
      setError("");
      await sync(value);
      setReady(true);
    } catch {
      setError("Veriler açılamadı. Mevcut veriler korunuyor; yeniden dene.");
    } finally {
      locked.current = false;
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
    const sub = AppState.addEventListener("change", (v) => {
      if (v === "active") {
        setNow(new Date());
        if (repository.current && !locked.current) {
          locked.current = true;
          setBusy(true);
          void sync(current.current).finally(() => {
            locked.current = false;
            setBusy(false);
          });
        }
      }
    });
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => {
        setNotice("");
        setUndo(null);
      },
      undo ? 6000 : 3000,
    );
    return () => clearTimeout(timer);
  }, [notice, undo]);
  async function commit(change: (v: State) => State): Promise<boolean> {
    if (locked.current || !repository.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const value = change(current.current);
      const plan = notificationPlan(value, new Date());
      const ids = new Set(plan.notices.map((n) => n.id));
      value.tasks = value.tasks.map((t) => ({
        ...t,
        notificationIds: ids.has(`task:${t.id}`) ? [`task:${t.id}`] : [],
      }));
      await repository.current.save(value);
      current.current = value;
      setState(value);
      setNow(new Date());
      await sync(value);
      return true;
    } catch {
      setError("Kaydedilemedi. Girdiğin bilgiler korundu; yeniden dene.");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function patch(task: Task) {
    return commit((v) => ({
      ...v,
      tasks: v.tasks.map((t) =>
        t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t,
      ),
    }));
  }
  const parsed = parseTurkish(text, now),
    due = override || parsed;
  const reminder = override
    ? override.reminderAt
    : defaultReminder(parsed.dueDate, parsed.dueTime, state.settings, now);
  async function add() {
    if (!text.trim() || locked.current) return;
    const task = {
      ...createTask(
        text,
        {
          dueDate: due.dueDate,
          dueTime: due.dueDate ? due.dueTime : undefined,
        },
        state.settings,
      ),
      reminderAt: reminder,
    };
    if (await commit((v) => ({ ...v, tasks: [...v.tasks, task] }))) {
      setText("");
      setOverride(null);
      setQuick(false);
      AccessibilityInfo.announceForAccessibility("Görev eklendi");
      input.current?.focus();
    }
  }
  async function complete(t: Task) {
    if (
      await patch({
        ...t,
        completedAt: t.completedAt ? undefined : new Date().toISOString(),
      })
    ) {
      setUndo(t);
      setNotice(t.completedAt ? "Yeniden açıldı" : "Tamamlandı");
      return true;
    }
    return false;
  }
  async function remove(t: Task) {
    if (
      await commit((v) => ({
        ...v,
        tasks: v.tasks.filter((x) => x.id !== t.id),
      }))
    ) {
      setUndo(t);
      setNotice("Silindi");
      setEditing(null);
    }
  }
  async function restore() {
    if (!undo) return;
    const previous = undo;
    if (
      await commit((v) => ({
        ...v,
        tasks: [...v.tasks.filter((t) => t.id !== previous.id), previous],
      }))
    ) {
      setUndo(null);
      setNotice("Geri alındı");
    }
  }
  async function snooze(t: Task) {
    const at = localDate(
      dayKey(addDays(new Date(), 1)),
      state.settings.summaryTime,
    ).toISOString();
    if (await patch({ ...t, reminderAt: at, snoozedUntil: at })) {
      setNotice(`Yarın ${state.settings.summaryTime} için hatırlatma seçildi`);
    }
  }
  const focus = attention(state.tasks, now),
    rows = list(state.tasks, tab, now);
  function row(t: Task) {
    return (
      <View key={t.id} style={s.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!t.completedAt }}
          accessibilityLabel={`${t.title} ${t.completedAt ? "yeniden aç" : "tamamla"}`}
          onPress={() => void complete(t)}
          style={s.check}
        >
          <Text style={{ fontSize: 25, color: blue }}>
            {t.completedAt ? "●" : "○"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.title}, ayrıntıları düzenle`}
          onPress={() => setEditing({ ...t })}
          style={{ flex: 1, paddingVertical: 13 }}
        >
          <Text
            style={[
              s.taskTitle,
              t.completedAt && {
                textDecorationLine: "line-through",
                color: "#667085",
              },
            ]}
          >
            {t.title}
          </Text>
          <Text style={s.meta}>
            {[
              status(t, now),
              t.dueDate
                ? `Teslim: ${dateLabel(t.dueDate)}${t.dueTime ? " " + t.dueTime : ""}`
                : "",
              t.plannedDate ? `Çalışma: ${dateLabel(t.plannedDate)}` : "",
              t.reminderAt
                ? `Hatırlatma: ${new Date(t.reminderAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Tarihsiz"}
          </Text>
          {tab === "Yaklaşan" && (
            <Text style={s.meta}>
              Sıradaki tarih: {dateLabel(futureDate(t, dayKey(now)))}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel={t.important ? "Önemi kaldır" : "Önemli işaretle"}
          accessibilityRole="button"
          onPress={() => void patch({ ...t, important: !t.important })}
          style={s.check}
        >
          <Text style={{ fontSize: 24, color: t.important ? blue : "#667085" }}>
            {t.important ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (!ready)
    return (
      <SafeAreaView style={[s.safe, { padding: 24, justifyContent: "center" }]}>
        {error ? (
          <>
            <Text>{error}</Text>
            <Button label="Yeniden dene" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator color={blue} />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.body}
        >
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>
              İşlerim
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ayarlar"
              onPress={() => setSettings(true)}
              style={s.check}
            >
              <Text style={{ fontSize: 26, color: "#667085" }}>⚙</Text>
            </Pressable>
          </View>
          <Text style={s.date}>
            {now.toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              weekday: "long",
              year: "numeric",
            })}
          </Text>
          <View style={s.composer}>
            <TextInput
              ref={input}
              accessibilityLabel="Yeni görev"
              placeholder="Aklında ne var?"
              placeholderTextColor="#667085"
              value={text}
              onChangeText={(v) => {
                setText(v);
                setOverride(null);
              }}
              onSubmitEditing={() => void add()}
              submitBehavior="submit"
              returnKeyType="done"
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Görevi ekle"
              disabled={busy || !text.trim()}
              onPress={() => void add()}
              style={[s.add, (busy || !text.trim()) && { opacity: 0.45 }]}
            >
              <Text style={{ fontSize: 27, color: "white" }}>+</Text>
            </Pressable>
          </View>
          {!!text && (
            <Pressable
              onPress={() => {
                if (!override)
                  setOverride({
                    dueDate: parsed.dueDate,
                    dueTime: parsed.dueTime,
                    reminderAt: reminder,
                  });
                setQuick(!quick);
              }}
              style={{ paddingVertical: 10, minHeight: 44 }}
              accessibilityLabel="Algılanan tarihi ve hatırlatmayı düzelt"
            >
              <Text style={s.meta}>
                {due.dueDate
                  ? `${dateLabel(due.dueDate)}${due.dueTime ? " · " + due.dueTime : ""}`
                  : parsed.warning}
                {due.dueDate
                  ? ` · Hatırlatma: ${reminder ? new Date(reminder).toLocaleString("tr-TR") : "seçilmedi"}`
                  : ""}{" "}
                · Düzenle
              </Text>
              {parsed.warning && due.dueDate && (
                <Text style={s.meta}>{parsed.warning}</Text>
              )}
            </Pressable>
          )}
          {quick && (
            <View style={s.inset}>
              <DateField
                label="Teslim tarihi"
                value={due.dueDate}
                onChange={(d) =>
                  setOverride({
                    ...override,
                    dueDate: d,
                    dueTime: d ? due.dueTime : undefined,
                    reminderAt: defaultReminder(
                      d,
                      due.dueTime,
                      state.settings,
                      new Date(),
                    ),
                  })
                }
              />
              {due.dueDate && (
                <DateField
                  label="Teslim saati (isteğe bağlı)"
                  time
                  value={due.dueTime}
                  onChange={(t) =>
                    setOverride({
                      ...override,
                      dueDate: due.dueDate,
                      dueTime: t,
                      reminderAt: defaultReminder(
                        due.dueDate,
                        t,
                        state.settings,
                        new Date(),
                      ),
                    })
                  }
                />
              )}
              <Timestamp
                label="Hatırlatma tarihi"
                value={reminder}
                onChange={(r) =>
                  setOverride({
                    dueDate: due.dueDate,
                    dueTime: due.dueTime,
                    reminderAt: r,
                  })
                }
              />
            </View>
          )}
          {!!error && (
            <View style={s.feedback}>
              <Text accessibilityRole="alert" style={{ color: "#A02F28" }}>
                {error}
              </Text>
              <Pressable
                onPress={() => setError("")}
                style={{ paddingVertical: 8 }}
              >
                <Text>Kapat</Text>
              </Pressable>
            </View>
          )}
          {!!notice && (
            <View style={s.feedback}>
              <Text accessibilityLiveRegion="polite">{notice}</Text>
              <View style={s.actions}>
                {undo && (
                  <Button
                    label="Geri al"
                    secondary
                    onPress={() => void restore()}
                  />
                )}
                <Button
                  label="Kapat"
                  secondary
                  onPress={() => {
                    setNotice("");
                    setUndo(null);
                  }}
                />
              </View>
            </View>
          )}
          {focus && (
            <View style={s.focus}>
              <Text style={[s.meta, { color: "#2459BF", fontWeight: "600" }]}>
                ☆ Önemli & yaklaşan
              </Text>
              <Pressable
                onPress={() => setEditing({ ...focus })}
                style={{ paddingVertical: 10 }}
              >
                <Text style={s.taskTitle} numberOfLines={2}>
                  {focus.title}
                </Text>
                <Text style={s.meta}>
                  {status(focus, now) ||
                    (focus.dueDate
                      ? `Teslim: ${dateLabel(focus.dueDate)}`
                      : "Önemli · tarihsiz")}
                </Text>
              </Pressable>
              <View style={s.actions}>
                {focus.plannedDate !== dayKey(now) && (
                  <Button
                    label="Bugüne ekle"
                    onPress={() =>
                      void patch({ ...focus, plannedDate: dayKey(now) })
                    }
                  />
                )}
                <Button
                  label={`Yarın hatırlat · ${state.settings.summaryTime}`}
                  secondary
                  onPress={() => void snooze(focus)}
                />
              </View>
            </View>
          )}
          <TaskTabs
            selected={tab}
            onSelect={setTab}
            reducedMotion={reducedMotion}
          />
          <TaskListTransition tab={tab} reducedMotion={reducedMotion}>
            {rows.length ? (
              rows.map(row)
            ) : (
              <Text style={s.empty}>
                {tab === "Bugün"
                  ? "Bugün için iş yok."
                  : tab === "Yaklaşan"
                    ? "Yaklaşan iş yok."
                    : "Tarihsiz iş yok. Aklındakini yukarıya yaz."}
              </Text>
            )}
          </TaskListTransition>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDone(!showDone)}
            style={{ paddingVertical: 20, minHeight: 44 }}
          >
            <Text style={s.meta}>
              {showDone ? "Tamamlananları gizle" : "Tamamlananları göster"} (
              {state.tasks.filter((t) => t.completedAt).length})
            </Text>
          </Pressable>
          {showDone && state.tasks.filter((t) => t.completedAt).map(row)}
        </ScrollView>
      </KeyboardAvoidingView>
      {editing && (
        <TaskEditor
          task={editing}
          setTask={setEditing}
          error={error}
          busy={busy}
          now={now}
          state={state}
          patch={patch}
          complete={complete}
          remove={remove}
          setNotice={setNotice}
        />
      )}
      {settings && (
        <SettingsScreen
          state={state}
          error={error}
          busy={busy}
          permission={permission}
          setPermission={setPermission}
          setError={setError}
          commit={commit}
          onClose={() => setSettings(false)}
        />
      )}
    </SafeAreaView>
  );
}
