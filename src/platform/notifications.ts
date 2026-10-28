import * as N from "expo-notifications";
import { IosAuthorizationStatus, AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { NotificationDriver } from "../domain/notifications";
N.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function allowed(): Promise<boolean> {
  const p = await N.getPermissionsAsync();
  return p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}
export async function requestNotifications(): Promise<boolean> {
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("tasks", {
      name: "Görevler",
      importance: AndroidImportance.DEFAULT,
    });
  await N.requestPermissionsAsync();
  return allowed();
}
export const driver: NotificationDriver = {
  allowed,
  pending: async () =>
    (await N.getAllScheduledNotificationsAsync()).map((n) => n.identifier),
  cancel: N.cancelScheduledNotificationAsync,
  schedule: async (n) => {
    await N.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: n.title,
        body: n.body,
        sound: "default",
        data: { taskId: n.taskId },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(n.at),
        channelId: "tasks",
      },
    });
  },
};
