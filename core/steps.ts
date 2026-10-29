import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Pedometer } from 'expo-sensors'
import { supabase } from './supabase/client'

// Pasos del día. El iPhone guarda los últimos 7 días y la app los lee; Android no da historial
// sin Health Connect (llega con la APK), así que ahí la tarjeta de pasos no se muestra.

export const DEFAULT_STEP_GOAL = 8000
const GOAL_KEY = 'finnets.stepGoal'

export type DaySteps = { date: string; steps: number }

// Fecha local del teléfono (no UTC): es el "hoy" que entiende el usuario
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const dailyStepsSupported = Platform.OS === 'ios'

export async function loadStepGoal() {
  try {
    const raw = await AsyncStorage.getItem(GOAL_KEY)
    const value = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_STEP_GOAL
  } catch {
    return DEFAULT_STEP_GOAL
  }
}

export async function saveStepGoal(goal: number) {
  await AsyncStorage.setItem(GOAL_KEY, String(goal)).catch(() => undefined)
}

// Lee los 7 días del iPhone, los guarda en daily_steps (para ver meses) y devuelve de lunes... a hoy
export async function syncDailySteps(userId: string): Promise<DaySteps[] | null> {
  if (!dailyStepsSupported) return null
  try {
    if (!(await Pedometer.isAvailableAsync())) return null
    const permission = await Pedometer.requestPermissionsAsync()
    if (!permission.granted) return null

    const days: DaySteps[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - i)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      const { steps } = await Pedometer.getStepCountAsync(start, end > now ? now : end)
      days.push({ date: localDate(start), steps })
    }

    await supabase
      .from('daily_steps')
      .upsert(days.filter((d) => d.steps > 0).map((d) => ({ user_id: userId, date: d.date, steps: d.steps, updated_at: new Date().toISOString() })))
    return days
  } catch {
    return null
  }
}

// Historial guardado (también de días que el iPhone ya borró)
export async function loadStepHistory(userId: string, days = 30): Promise<DaySteps[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data } = await supabase
    .from('daily_steps')
    .select('date, steps')
    .eq('user_id', userId)
    .gte('date', localDate(since))
    .order('date')
  return (data || []) as DaySteps[]
}
