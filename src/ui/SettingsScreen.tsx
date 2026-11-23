import React from "react";
import {
  Text,
  View,
  Switch,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { State } from "../domain/model";
import { allowed, requestNotifications } from "../platform/notifications";
import { Button, Sheet } from "./Controls";
import { DateField } from "./DateField";
import { s } from "./styles";
import { c } from "./theme";
import { useReducedMotion } from "./TaskTabs";
import { selectionFeedback } from "../platform/haptics";
type Props = {
  state: State;
  error: string;
  busy: boolean;
  permission: boolean;
  setPermission: (b: boolean) => void;
  setError: (s: string) => void;
  commit: (f: (v: State) => State) => Promise<boolean>;
  onClose: () => void;
};
export function SettingsScreen({
  state,
  error,
  busy,
  permission,
  setPermission,
  setError,
  commit,
  onClose,
}: Props) {
  const reduced = useReducedMotion();
  const [choice, setChoice] = React.useState<"days" | "hours" | null>(null);
  async function toggleNotifications(value: boolean) {
    try {
      if (value && !(await requestNotifications())) {
        Alert.alert(
          "Bildirim izni verilmedi",
          "Görevler kullanılabilir. Sistem Ayarları’ndan izin verebilirsin.",
        );
        return;
      }
      await commit((v) => ({
        ...v,
        settings: { ...v.settings, notifications: value },
      }));
      setPermission(await allowed());
    } catch {
      setError("Bildirim izni kontrol edilemedi.");
    }
  }
  const row = (
    label: string,
    value: boolean,
    change: (v: boolean) => void,
    disabled = false,
  ) => (
    <View style={s.fieldRow}>
      <Text style={[s.taskTitle, { flex: 1 }]}>{label}</Text>
      <Switch
        trackColor={{ true: c.blue }}
        accessibilityLabel={label}
        value={value}
        disabled={disabled || busy}
        onValueChange={(v) => {
          selectionFeedback();
          change(v);
        }}
      />
    </View>
  );
  const section = (title: string, children: React.ReactNode) => (
    <>
      <Text style={s.section}>{title}</Text>
      <View style={s.taskCard}>{children}</View>
    </>
  );
  return (
    <Modal animationType={reduced ? "none" : "slide"} onRequestClose={onClose}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingHorizontal: 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={onClose}
              style={s.check}
            >
              <Ionicons name="chevron-back" size={26} color={c.navy} />
            </Pressable>
            <Text style={[s.title, { flex: 1, color: c.navy }]}>Ayarlar</Text>
          </View>
          {!!error && (
            <View style={s.error}>
              <Text accessibilityRole="alert" style={s.errorText}>
                {error}
              </Text>
            </View>
          )}
          {section(
            "Bildirimler",
            <>
              {row(
                "Bildirimler",
                state.settings.notifications,
                (v) => void toggleNotifications(v),
              )}
              {row(
                "Günlük özet",
                state.settings.summary,
                (v) =>
                  void commit((x) => ({
                    ...x,
                    settings: { ...x.settings, summary: v },
                  })),
                !state.settings.notifications,
              )}
              <DateField
                clearable={false}
                label="Özet saati"
                time
                value={state.settings.summaryTime}
                onChange={(time) => {
                  if (time)
                    void commit((x) => ({
                      ...x,
                      settings: { ...x.settings, summaryTime: time },
                    }));
                }}
              />
              <Text style={s.meta}>
                İzin: {permission ? "verildi" : "verilmedi"}
              </Text>
            </>,
          )}
          <Text style={[s.meta, { marginTop: 10, marginHorizontal: 4 }]}>
            Bugünün işleri ve yaklaşan teslimler. Özet, uygulama açıldığında
            sonraki 7 gün için güncellenir.
          </Text>
          {section(
            "Varsayılan hatırlatma",
            <>
              <Pressable
                style={s.fieldRow}
                accessibilityRole="button"
                onPress={() => setChoice("days")}
              >
                <Text style={[s.taskTitle, { flex: 1 }]}>Tarihli işler</Text>
                <Text style={s.meta}>
                  {state.settings.daysBefore ?? 1} gün önce ›
                </Text>
              </Pressable>
              <Pressable
                style={s.fieldRow}
                accessibilityRole="button"
                onPress={() => setChoice("hours")}
              >
                <Text style={[s.taskTitle, { flex: 1 }]}>Saatli işler</Text>
                <Text style={s.meta}>
                  {state.settings.hoursBefore} saat önce ›
                </Text>
              </Pressable>
              <DateField
                clearable={false}
                label="Varsayılan saat"
                time
                value={state.settings.previousDayTime}
                onChange={(time) => {
                  if (time)
                    void commit((x) => ({
                      ...x,
                      settings: { ...x.settings, previousDayTime: time },
                    }));
                }}
              />
            </>,
          )}
          {section(
            "Erişilebilirlik",
            <>
              {row(
                "Hareketi azalt",
                !!state.settings.reduceMotion,
                (v) =>
                  void commit((x) => ({
                    ...x,
                    settings: { ...x.settings, reduceMotion: v },
                  })),
              )}
              <Text style={s.meta}>
                Sistemin Hareketi Azalt tercihi de her zaman uygulanır.
              </Text>
            </>,
          )}
          <Text style={[s.meta, { marginVertical: 16, marginHorizontal: 4 }]}>
            Verilerin bu cihazda saklanır.
          </Text>
          <Button
            secondary
            label="Sistem bildirim ayarları"
            onPress={() => void Linking.openSettings()}
          />
          <Button
            secondary
            disabled={busy}
            label="Bildirim takvimini yeniden dene"
            onPress={() => void commit((v) => ({ ...v }))}
          />
        </ScrollView>
      </SafeAreaView>
      {choice && (
        <Sheet
          title={choice === "days" ? "Kaç gün önce?" : "Kaç saat önce?"}
          onClose={() => setChoice(null)}
        >
          {(choice === "days" ? [0, 1, 2, 3, 7] : [1, 2, 3]).map((n) => (
            <Button
              key={n}
              label={`${n} ${choice === "days" ? "gün" : "saat"} önce`}
              disabled={busy}
              onPress={() =>
                void (async () => {
                  if (
                    await commit((v) => ({
                      ...v,
                      settings: {
                        ...v.settings,
                        ...(choice === "days"
                          ? { daysBefore: n }
                          : { hoursBefore: n }),
                      },
                    }))
                  )
                    setChoice(null);
                })()
              }
            />
          ))}
        </Sheet>
      )}
    </Modal>
  );
}
