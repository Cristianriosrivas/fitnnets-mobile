import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'

// Notificaciones LOCALES: las programa este telefono, funcionan con la app cerrada y en Expo Go.
// Avisos que nacen en otro telefono (rutina asignada por un amigo) solo se detectan al abrir la app;
// para recibirlos con la app cerrada harian falta notificaciones push.

const CHANNEL_ID = 'recordatorios'
const SETTINGS_KEY = 'finnets.reminders.v1'
const TRAIN_ID = (weekday: number) => `recordatorio-entrenar-${weekday}`
const WEIGHT_ID = 'recordatorio-peso'

// weekday con el formato de expo-notifications: 1 = domingo ... 7 = sabado
export type ReminderSettings = {
  train: { enabled: boolean; weekdays: number[]; hour: number; minute: number }
  weight: { enabled: boolean; weekday: number; hour: number; minute: number }
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  train: { enabled: false, weekdays: [2, 3, 4, 5, 6], hour: 18, minute: 0 },
  weight: { enabled: false, weekday: 2, hour: 7, minute: 0 },
}

// Se llama una vez al cargar la app: muestra el aviso tambien con la app abierta
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

export async function ensureNotificationPermission(): Promise<boolean> {
  // En Android 13+ el permiso no se puede pedir hasta que exista al menos un canal
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios y avisos',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted
}

export async function loadReminders(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_REMINDERS
    const saved = JSON.parse(raw) as Partial<ReminderSettings>
    return {
      train: { ...DEFAULT_REMINDERS.train, ...saved.train },
      weight: { ...DEFAULT_REMINDERS.weight, ...saved.weight },
    }
  } catch {
    return DEFAULT_REMINDERS
  }
}

// Reprograma desde cero los recordatorios (identificadores fijos: guardar dos veces no los duplica)
export async function applyReminders(settings: ReminderSettings) {
  const ids = [1, 2, 3, 4, 5, 6, 7].map(TRAIN_ID).concat(WEIGHT_ID)
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)))

  if (settings.train.enabled) {
    for (const weekday of settings.train.weekdays) {
      await Notifications.scheduleNotificationAsync({
        identifier: TRAIN_ID(weekday),
        content: {
          title: 'Hora de entrenar 💪',
          body: 'Tu rutina te espera. Cada sesión suma a tu racha.',
          data: { url: '/(main)/(tabs)/rutinas' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: settings.train.hour,
          minute: settings.train.minute,
          channelId: CHANNEL_ID,
        },
      })
    }
  }

  if (settings.weight.enabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: WEIGHT_ID,
      content: {
        title: 'Registra tu peso ⚖️',
        body: 'Anota tu peso de hoy para ver tu evolución en Progreso.',
        data: { url: '/(main)/(tabs)/progreso' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: settings.weight.weekday,
        hour: settings.weight.hour,
        minute: settings.weight.minute,
        channelId: CHANNEL_ID,
      },
    })
  }

  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// Aviso inmediato (rutina asignada, insignia nueva, prueba). Devuelve false si no hay permiso,
// para que quien llama muestre el aviso dentro de la app.
export async function notifyNow(title: string, body: string, url?: string): Promise<boolean> {
  if (!(await hasNotificationPermission())) return false
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: url ? { url } : {} },
    trigger: null,
  })
  return true
}
