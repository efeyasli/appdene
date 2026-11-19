import React, { useEffect, useMemo, useRef, useState } from "react";
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
  LayoutAnimation,
  AccessibilityInfo,
  Animated,
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
import { attentionCandidates, list, Tab } from "./src/domain/selectors";
import { notificationPlan, reconcile } from "./src/domain/notifications";
import { Repository } from "./src/data/repository";
import { openRepository } from "./src/data/sqlite";
import { allowed, driver } from "./src/platform/notifications";
import { DateField } from "./src/ui/DateField";
import { Button, Sheet, Timestamp } from "./src/ui/Controls";
import { s } from "./src/ui/styles";
import { TaskEditor } from "./src/ui/TaskEditor";
import { SettingsScreen } from "./src/ui/SettingsScreen";
import { TaskTabs, MotionContext, useReducedMotion } from "./src/ui/TaskTabs";
import { AttentionCarousel } from "./src/ui/AttentionCarousel";
import { TaskPager } from "./src/ui/TaskPager";
import { TaskRow, RowActions } from "./src/ui/TaskRow";
import { selectionFeedback } from "./src/platform/haptics";
const accent = "#FFE68A";
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}
type Override = { dueDate?: string; dueTime?: string; reminderAt?: string };
function Main() {
  const [state, setState] = useState<State>(emptyState),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(new Date());
  const reducedMotion = useReducedMotion(state.settings.reduceMotion);
  const repository = useRef<Repository | null>(null),
    current = useRef(state),
    loading = useRef(false),
    adding = useRef(false),
    // Writes run one after another instead of dropping taps made while saving.
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    pendingWrites = useRef(0),
    syncing = useRef(false),
    syncAgain = useRef(false),
    motion = useRef(reducedMotion);
  useEffect(() => {
    motion.current = reducedMotion;
  }, [reducedMotion]);
  const [text, setText] = useState(""),
    [tab, setTab] = useState<Tab>("Bugün"),
    [quick, setQuick] = useState(false),
    // Set only when the user picks a date/reminder by hand; typing keeps it.
    [override, setOverride] = useState<Override | null>(null);
  const [editing, setEditing] = useState<Task | null>(null),
    [settings, setSettings] = useState(false),
    [permission, setPermission] = useState(false),
    [showDone, setShowDone] = useState(false),
    [undo, setUndo] = useState<Task | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [scrollX] = useState(() => new Animated.Value(0)),
    [pagerWidth, setPagerWidth] = useState(0);
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
  // Notification scheduling runs after the write, off the tap's critical path.
  // Bursts of edits collapse into one more pass over the latest state.
  function requestSync() {
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    syncing.current = true;
    void (async () => {
      do {
        syncAgain.current = false;
        await sync(current.current);
      } while (syncAgain.current);
      syncing.current = false;
    })();
  }
  async function load() {
    if (loading.current) return;
    loading.current = true;
    try {
      const repo = await openRepository();
      repository.current = repo;
      const value = await repo.load();
      current.current = value;
      setState(value);
      setError("");
      setReady(true);
      requestSync();
    } catch {
      setError("Veriler açılamadı. Mevcut veriler korunuyor; yeniden dene.");
    } finally {
      loading.current = false;
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
    const sub = AppState.addEventListener("change", (v) => {
      if (v === "active") {
        setNow(new Date());
        if (repository.current) requestSync();
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
  function animateNext() {
    if (!motion.current)
      LayoutAnimation.configureNext({
        duration: 220,
        update: { type: "easeInEaseOut" },
        delete: { type: "easeInEaseOut", property: "opacity" },
        create: { type: "easeInEaseOut", property: "opacity" },
      });
  }
  // Optimistic: the screen updates immediately, the write follows, and a
  // failed write puts the previous state back and says so.
  function commit(change: (v: State) => State): Promise<boolean> {
    const repo = repository.current;
    if (!repo) return Promise.resolve(false);
    const run = async () => {
      const previous = current.current;
      const value = change(previous);
      const plan = notificationPlan(value, new Date());
      const ids = new Set(plan.notices.map((n) => n.id));
      value.tasks = value.tasks.map((t) => ({
        ...t,
        notificationIds: ids.has(`task:${t.id}`) ? [`task:${t.id}`] : [],
      }));
      current.current = value;
      setError("");
      animateNext();
      setState(value);
      setNow(new Date());
      try {
        await repo.save(value);
        requestSync();
        return true;
      } catch {
        if (current.current === value) {
          current.current = previous;
          animateNext();
          setState(previous);
        }
        setError("Kaydedilemedi. Girdiğin bilgiler korundu; yeniden dene.");
        return false;
      }
    };
    pendingWrites.current++;
    setBusy(true);
    const result = queue.current.then(run).finally(() => {
      if (--pendingWrites.current === 0) setBusy(false);
    });
    queue.current = result.catch(() => {});
    return result;
  }
  // Complete/delete act on the saved task, never on an unsaved editor draft.
  const stored = (t: Task) =>
    current.current.tasks.find((x) => x.id === t.id) ?? t;
  async function patch(task: Task) {
    return commit((v) => ({
      ...v,
      tasks: v.tasks.map((t) =>
        t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t,
      ),
    }));
  }
  const parsed = useMemo(() => parseTurkish(text, now), [text, now]),
    due = override || parsed;
  const reminder = override
    ? override.reminderAt
    : defaultReminder(parsed.dueDate, parsed.dueTime, state.settings, now);
  async function add() {
    if (!text.trim() || adding.current) return;
    adding.current = true;
    try {
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
      const entered = text,
        chosen = override;
      setText("");
      setOverride(null);
      setQuick(false);
      if (await commit((v) => ({ ...v, tasks: [...v.tasks, task] }))) {
        AccessibilityInfo.announceForAccessibility("Görev eklendi");
        input.current?.focus();
      } else {
        setText((t) => t || entered);
        setOverride((o) => o ?? chosen);
      }
    } finally {
      adding.current = false;
    }
  }
  async function complete(draft: Task) {
    const t = stored(draft);
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
  async function remove(draft: Task) {
    const t = stored(draft);
    setEditing(null);
    if (
      await commit((v) => ({
        ...v,
        tasks: v.tasks.filter((x) => x.id !== t.id),
      }))
    ) {
      setUndo(t);
      setNotice("Silindi");
    }
  }
  async function restore() {
    if (!undo) return;
    const previous = undo;
    setUndo(null);
    if (
      await commit((v) => ({
        ...v,
        tasks: [...v.tasks.filter((t) => t.id !== previous.id), previous],
      }))
    )
      setNotice("Geri alındı");
  }
  async function snooze(t: Task) {
    const at = localDate(
      dayKey(addDays(new Date(), 1)),
      state.settings.summaryTime,
    ).toISOString();
    if (await patch({ ...stored(t), reminderAt: at, snoozedUntil: at })) {
      setNotice(`Yarın ${state.settings.summaryTime} için hatırlatma seçildi`);
    }
  }
  // Stable callbacks for memoized rows; they always call the latest handlers.
  const latest = useRef({ complete, patch, snooze, stored });
  useEffect(() => {
    latest.current = { complete, patch, snooze, stored };
  });
  const rowActions = useMemo<RowActions>(
    () => ({
      open: (t) => setEditing({ ...t }),
      complete: (t) => latest.current.complete(t),
      toggleImportant: (t) => {
        const x = latest.current.stored(t);
        void latest.current.patch({ ...x, important: !x.important });
      },
    }),
    [],
  );
  const today = dayKey(now);
  const focus = useMemo(
    () => attentionCandidates(state.tasks, now).slice(0, 5),
    [state.tasks, now],
  );
  const pages = useMemo(
    () =>
      Object.fromEntries(
        (["Bugün", "Yaklaşan", "Sonra"] as Tab[]).map((p) => [
          p,
          list(state.tasks, p, localDate(today, "12:00")),
        ]),
      ) as Record<Tab, Task[]>,
    [state.tasks, today],
  );
  const done = useMemo(
    () => state.tasks.filter((t) => t.completedAt),
    [state.tasks],
  );
  const row = (t: Task, page?: Tab) => (
    <TaskRow
      key={t.id}
      task={t}
      today={today}
      page={page}
      reduced={reducedMotion}
      actions={rowActions}
    />
  );
  if (!ready)
    return (
      <SafeAreaView style={[s.safe, { padding: 24, justifyContent: "center" }]}>
        {error ? (
          <>
            <Text>{error}</Text>
            <Button label="Yeniden dene" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator color={accent} />
        )}
      </SafeAreaView>
    );
  return (
    <MotionContext.Provider value={reducedMotion}>
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
                <Text style={{ fontSize: 26, color: "white" }}>⚙</Text>
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
                placeholder="Aklındakini yaz…"
                placeholderTextColor="#7065AC"
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  if (!v) setOverride(null);
                }}
                onSubmitEditing={() => void add()}
                submitBehavior="submit"
                returnKeyType="done"
                style={s.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Görevi ekle"
                disabled={!text.trim()}
                onPress={() => void add()}
                style={[s.add, !text.trim() && { opacity: 0.45 }]}
              >
                <Text style={{ fontSize: 27, color: "#5D47D9" }}>↑</Text>
              </Pressable>
            </View>
            {!!text && (
              <Pressable
                onPress={() => setQuick(true)}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  minHeight: 44,
                  opacity: pressed ? 0.6 : 1,
                })}
                accessibilityLabel="Algılanan tarihi ve hatırlatmayı düzelt"
              >
                <Text style={[s.meta, { color: "#E5DEFF" }]}>
                  {due.dueDate
                    ? `${dateLabel(due.dueDate)}${due.dueTime ? " · " + due.dueTime : ""}`
                    : parsed.warning}
                  {due.dueDate
                    ? ` · Hatırlatma: ${reminder ? new Date(reminder).toLocaleString("tr-TR") : "seçilmedi"}`
                    : ""}{" "}
                  · {override ? "Elle seçildi · Düzenle" : "Düzenle"}
                </Text>
                {!override && parsed.warning && due.dueDate && (
                  <Text style={[s.meta, { color: "#E5DEFF" }]}>
                    {parsed.warning}
                  </Text>
                )}
              </Pressable>
            )}
            {!!text && override && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOverride(null)}
                style={{ paddingBottom: 8, minHeight: 32 }}
              >
                <Text style={[s.meta, { color: "#FFE68A" }]}>
                  Metinden algılanan tarihe dön
                </Text>
              </Pressable>
            )}
            {quick && (
              <Sheet
                title="Tarih ve hatırlatma"
                onClose={() => setQuick(false)}
              >
                <DateField
                  label="Teslim tarihi"
                  value={due.dueDate}
                  onChange={(d) =>
                    setOverride({
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
              </Sheet>
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
            <AttentionCarousel
              tasks={focus}
              now={now}
              reduced={reducedMotion}
              onOpen={(t) => setEditing({ ...t })}
              onToday={(t) =>
                void patch({ ...stored(t), plannedDate: dayKey(now) })
              }
              onSnooze={(t) => void snooze(t)}
            />
            <TaskTabs
              selected={tab}
              scrollX={scrollX}
              pagerWidth={pagerWidth}
              onSelect={(t) => {
                if (t !== tab) selectionFeedback();
                setTab(t);
              }}
              reducedMotion={reducedMotion}
            />
            <TaskPager
              selected={tab}
              onSelect={setTab}
              reduced={reducedMotion}
              scrollX={scrollX}
              onWidth={setPagerWidth}
              renderPage={(page) => {
                const rows = pages[page];
                return (
                  <View style={s.taskCard}>
                    <View style={s.setting}>
                      <Text style={s.h2}>
                        {page === "Bugün"
                          ? "Bugünün odağı"
                          : page === "Yaklaşan"
                            ? "Yaklaşan işler"
                            : "Sonra bakılacaklar"}
                      </Text>
                      <Text style={s.meta}>{rows.length} iş</Text>
                    </View>
                    {rows.length ? (
                      rows.map((t) => row(t, page))
                    ) : (
                      <Text style={s.empty}>
                        {page === "Bugün"
                          ? "Bugün için iş yok."
                          : page === "Yaklaşan"
                            ? "Yaklaşan iş yok."
                            : "Aklındakini yukarıya yaz."}
                      </Text>
                    )}
                  </View>
                );
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDone(!showDone)}
              style={{ paddingVertical: 20, minHeight: 44 }}
            >
              <Text style={[s.meta, { color: "#E5DEFF" }]}>
                {showDone ? "Tamamlananları gizle" : "Tamamlananları göster"} (
                {done.length})
              </Text>
            </Pressable>
            {showDone && (
              <View style={s.taskCard}>{done.map((t) => row(t))}</View>
            )}
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
    </MotionContext.Provider>
  );
}
