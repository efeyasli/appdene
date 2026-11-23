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
  Keyboard,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  State,
  Task,
  emptyState,
  createTask,
  dayKey,
  localDate,
  dateLabel,
  defaultReminder,
} from "./src/domain/model";
import { parseTurkish } from "./src/domain/parse";
import { futureDate, list, Tab } from "./src/domain/selectors";
import { notificationPlan, reconcile } from "./src/domain/notifications";
import { Repository } from "./src/data/repository";
import { openRepository } from "./src/data/sqlite";
import { allowed, driver } from "./src/platform/notifications";
import { DateField } from "./src/ui/DateField";
import { Button, Sheet, Timestamp } from "./src/ui/Controls";
import { s } from "./src/ui/styles";
import { c } from "./src/ui/theme";
import { TaskEditor } from "./src/ui/TaskEditor";
import { SettingsScreen } from "./src/ui/SettingsScreen";
import { TaskTabs, MotionContext, useReducedMotion } from "./src/ui/TaskTabs";
import { TaskPager } from "./src/ui/TaskPager";
import { TaskRow, RowActions } from "./src/ui/TaskRow";
import { selectionFeedback } from "./src/platform/haptics";
export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  // Fonts are bundled, so this is a few frames; avoid a flash of system font.
  if (!fontsLoaded) return null;
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
  const insets = useSafeAreaInsets(),
    [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboard(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
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
  // Stable callbacks for memoized rows; they always call the latest handlers.
  const latest = useRef({ complete, patch, stored });
  useEffect(() => {
    latest.current = { complete, patch, stored };
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
  const overdue = useMemo(
    () =>
      state.tasks.filter(
        (t) => !t.completedAt && t.dueDate && t.dueDate < today,
      ).length,
    [state.tasks, today],
  );
  const next = pages["Yaklaşan"][0];
  const nextDay = next ? futureDate(next, today) : undefined;
  const nextLabel = nextDay
    ? localDate(nextDay).getTime() - localDate(today).getTime() < 7 * 86400000
      ? localDate(nextDay).toLocaleDateString("tr-TR", { weekday: "long" })
      : localDate(nextDay).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short",
        })
    : "Yok";
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
            <Text style={[s.taskTitle, { marginBottom: 12 }]}>{error}</Text>
            <Button label="Yeniden dene" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator color={c.blue} />
        )}
      </SafeAreaView>
    );
  const stat = (
    value: string | number,
    label: string,
    target: Tab,
    highlight = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        if (target !== tab) selectionFeedback();
        setTab(target);
      }}
      style={({ pressed }) => [s.stat, pressed && { opacity: 0.75 }]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[s.statValue, highlight && { color: c.cyan }]}
      >
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
  return (
    <MotionContext.Provider value={reducedMotion}>
      <View style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={s.body}
          >
            <View style={[s.hero, { paddingTop: insets.top + 10 }]}>
              {/* Navy continues above the header when the list bounces. */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: -1000,
                  left: 0,
                  right: 0,
                  height: 1000,
                  backgroundColor: c.navy,
                }}
              />
              <View style={s.header}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={s.date}>
                    {now.toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })}
                  </Text>
                  <Text accessibilityRole="header" style={s.title}>
                    İşlerim
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ayarlar"
                  hitSlop={8}
                  onPress={() => setSettings(true)}
                  style={({ pressed }) => [
                    s.check,
                    {
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: 22,
                      backgroundColor: c.navyRaised,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="settings-outline" size={21} color={c.white} />
                </Pressable>
              </View>
              <View style={s.stats}>
                {stat(pages["Bugün"].length, "bugün", "Bugün", true)}
                {stat(overdue, "gecikmiş", "Bugün")}
                {stat(nextLabel, "sıradaki teslim", "Yaklaşan")}
              </View>
            </View>
            <View style={s.content}>
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
                      {rows.length ? (
                        rows.map((t) => row(t, page))
                      ) : (
                        <Text style={s.empty}>
                          {page === "Bugün"
                            ? "Bugün için iş yok."
                            : page === "Yaklaşan"
                              ? "Yaklaşan iş yok."
                              : "Tarihsiz işler burada toplanır."}
                        </Text>
                      )}
                    </View>
                  );
                }}
              />
              {done.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowDone(!showDone)}
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name={showDone ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={c.slate}
                  />
                  <Text style={[s.meta, { fontSize: 14 }]}>
                    Tamamlananlar ({done.length})
                  </Text>
                </Pressable>
              )}
              {showDone && done.length > 0 && (
                <View style={s.taskCard}>{done.map((t) => row(t))}</View>
              )}
            </View>
          </ScrollView>
          <View
            style={[
              s.composerWrap,
              { paddingBottom: keyboard ? 8 : Math.max(insets.bottom, 12) },
            ]}
          >
            {!!error && (
              <View style={s.error}>
                <Text accessibilityRole="alert" style={s.errorText}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hatayı kapat"
                  hitSlop={10}
                  onPress={() => setError("")}
                >
                  <Ionicons name="close" size={18} color={c.danger} />
                </Pressable>
              </View>
            )}
            {!!notice && (
              <View style={s.feedback}>
                <Text accessibilityLiveRegion="polite" style={s.feedbackText}>
                  {notice}
                </Text>
                {undo && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => void restore()}
                  >
                    <Text style={s.feedbackAction}>Geri al</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bildirimi kapat"
                  hitSlop={10}
                  onPress={() => {
                    setNotice("");
                    setUndo(null);
                  }}
                >
                  <Ionicons name="close" size={18} color={c.navyMuted} />
                </Pressable>
              </View>
            )}
            {!!text && (
              <Pressable
                onPress={() => setQuick(true)}
                accessibilityRole="button"
                accessibilityLabel="Algılanan tarihi ve hatırlatmayı düzelt"
                style={({ pressed }) => [s.chip, pressed && { opacity: 0.6 }]}
              >
                <View style={s.chipPill}>
                  <Text style={s.chipText}>
                    <Ionicons name="calendar-outline" size={12} />{" "}
                    {due.dueDate
                      ? `${dateLabel(due.dueDate)}${due.dueTime ? " · " + due.dueTime : ""}`
                      : "Tarih yok"}
                  </Text>
                </View>
                {!!due.dueDate && (
                  <View style={s.chipPill}>
                    <Text style={s.chipText}>
                      <Ionicons name="notifications-outline" size={12} />{" "}
                      {reminder
                        ? new Date(reminder).toLocaleString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Hatırlatma yok"}
                    </Text>
                  </View>
                )}
                <Text
                  style={[s.chipText, { color: c.blue, paddingHorizontal: 4 }]}
                >
                  {override ? "Elle seçildi · Düzenle" : "Düzenle"}
                </Text>
                {override && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setOverride(null)}
                  >
                    <Text style={[s.chipText, { color: c.slate }]}>
                      Algılanana dön
                    </Text>
                  </Pressable>
                )}
                {!override && !!parsed.warning && (
                  <Text style={[s.meta, { width: "100%", paddingLeft: 4 }]}>
                    {parsed.warning}
                  </Text>
                )}
              </Pressable>
            )}
            <View style={s.composer}>
              <TextInput
                ref={input}
                accessibilityLabel="Yeni görev"
                placeholder="Aklındakini yaz… ör. Cuma 14:00 sunum"
                placeholderTextColor={c.slate}
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
                style={({ pressed }) => [
                  s.add,
                  !text.trim() && { backgroundColor: c.track },
                  pressed && { backgroundColor: c.bluePressed },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={22}
                  color={text.trim() ? c.white : c.slate}
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
        {/* Keeps the light status bar readable once the header scrolls away. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: c.navy,
          }}
        />
        {quick && (
          <Sheet title="Tarih ve hatırlatma" onClose={() => setQuick(false)}>
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
      </View>
    </MotionContext.Provider>
  );
}
