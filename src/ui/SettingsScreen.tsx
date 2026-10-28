import React from "react";
import { Text, View, Switch, Alert, Linking } from "react-native";
import { State } from "../domain/model";
import { allowed, requestNotifications } from "../platform/notifications";
import { Button, Sheet } from "./Controls";
import { DateField } from "./DateField";
import { s } from "./styles";
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
  return (
    <Sheet title="Ayarlar" onClose={onClose}>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#A02F28" }}>
          {error}
        </Text>
      )}
      <Text style={s.h2}>Bildirimler</Text>
      <Text style={s.meta}>
        İzin: {permission ? "verildi" : "verilmedi"} · Hatırlatmalar:{" "}
        {state.settings.notifications ? "açık" : "kapalı"}
      </Text>
      <Button
        label={
          state.settings.notifications
            ? "Hatırlatmaları kapat"
            : "Yerel bildirimleri etkinleştir"
        }
        disabled={busy}
        onPress={() =>
          void (async () => {
            if (state.settings.notifications) {
              await commit((v) => ({
                ...v,
                settings: { ...v.settings, notifications: false },
              }));
              return;
            }
            try {
              if (await requestNotifications())
                await commit((v) => ({
                  ...v,
                  settings: { ...v.settings, notifications: true },
                }));
              else
                Alert.alert(
                  "Bildirim izni verilmedi",
                  "Görevlerini kullanmaya devam edebilirsin. Sistem Ayarları’ndan bildirimlere izin verebilirsin.",
                );
              setPermission(await allowed());
            } catch {
              setError("Bildirim izni kontrol edilemedi.");
            }
          })()
        }
      />
      <Button
        secondary
        label="Sistem ayarlarını aç"
        onPress={() => void Linking.openSettings()}
      />
      <Button
        secondary
        label="Bildirim takvimini yeniden dene"
        disabled={busy}
        onPress={() => void commit((v) => ({ ...v }))}
      />
      <Text style={s.h2}>Varsayılanlar</Text>
      <Text style={s.meta}>
        Yeni görevlerde uygulanır. Teslim saati oluşturmaz.
      </Text>
      <DateField
        clearable={false}
        label="Saatsiz iş: bir önceki gün"
        time
        value={state.settings.previousDayTime}
        onChange={(time) => {
          if (time)
            void commit((v) => ({
              ...v,
              settings: { ...v.settings, previousDayTime: time },
            }));
        }}
      />
      <Text style={s.meta}>
        Saatli iş: teslimden {state.settings.hoursBefore} saat önce
      </Text>
      <View style={s.actions}>
        {[1, 2, 3].map((n) => (
          <Button
            key={n}
            label={`${n} saat`}
            secondary={state.settings.hoursBefore !== n}
            onPress={() =>
              void commit((v) => ({
                ...v,
                settings: { ...v.settings, hoursBefore: n },
              }))
            }
          />
        ))}
      </View>
      <View style={s.setting}>
        <Text>Günlük özet</Text>
        <Switch
          accessibilityLabel="Günlük özet"
          value={state.settings.summary}
          disabled={!state.settings.notifications || busy}
          onValueChange={(summary) =>
            void commit((v) => ({
              ...v,
              settings: { ...v.settings, summary },
            }))
          }
        />
      </View>
      <DateField
        clearable={false}
        label="Günlük özet ve yarına erteleme saati"
        time
        value={state.settings.summaryTime}
        onChange={(time) => {
          if (time)
            void commit((v) => ({
              ...v,
              settings: { ...v.settings, summaryTime: time },
            }));
        }}
      />
      <Text style={s.meta}>
        Özet, uygulama açıldığında mevcut verilerle sonraki 7 gün için
        hazırlanır. Boş günlerde kurulmaz. Daha uzun süre açmazsan yeni özet
        gelmez. Cihazdaki en yakın 50 bildirime öncelik verilir.
      </Text>
      <Text style={s.meta}>
        Veriler yalnızca bu cihazda saklanır. Takvim günleri yerel gün olarak,
        hatırlatmalar sabit bir zaman anı olarak korunur; saat dilimi değişince
        bildirim aynı anda, yeni yerel saatle görünür.
      </Text>
    </Sheet>
  );
}
