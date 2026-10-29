import { supabase } from './supabase/client'
import { ALL_REGIONS, REGION_LABEL, Region, regionsFor } from './muscles'

// Recuperación muscular: cuánto se ha recuperado cada músculo según lo que entrenaste y hace
// cuántas horas, y qué día de tus rutinas te conviene hoy. Modelo simple y explicable:
// 8 series ponderadas dejan un músculo agotado y la fatiga baja en línea recta hasta su tiempo
// de recuperación (más largo en músculos grandes). Es una guía, no un diagnóstico.

const RECOVERY_HOURS: Record<Region, number> = {
  quads: 72, hamstrings: 72, glutes: 72, lowerBack: 72,
  chest: 60, lats: 60,
  upperBack: 48, shoulders: 48, traps: 48,
  biceps: 36, triceps: 36, calves: 36,
  forearms: 30, abs: 30, obliques: 30,
}

const SETS_FOR_FULL_FATIGUE = 8

export type RegionRecovery = { recovery: number; hoursToFull: number }
export type RecoveryMap = Record<Region, RegionRecovery>

type LogRow = { sets: number; at: number; name: string; muscleGroup: string | null }

export async function loadRecentLogs(userId: string): Promise<LogRow[]> {
  const since = new Date(Date.now() - 4 * 86400000).toISOString()
  const { data, error } = await supabase
    .from('progress_logs')
    .select('sets_completed, created_at, exercises(name, muscle_group)')
    .eq('user_id', userId)
    .gte('created_at', since)
  if (error) throw error
  return ((data || []) as any[]).map((r) => ({
    sets: Number(r.sets_completed) || 0,
    at: Date.parse(r.created_at),
    name: r.exercises?.name || '',
    muscleGroup: r.exercises?.muscle_group ?? null,
  }))
}

export function computeRecovery(logs: LogRow[], now = Date.now()): RecoveryMap {
  const fatigue = Object.fromEntries(ALL_REGIONS.map((r) => [r, 0])) as Record<Region, number>
  const hours = Object.fromEntries(ALL_REGIONS.map((r) => [r, 0])) as Record<Region, number>

  for (const log of logs) {
    const elapsed = (now - log.at) / 3600000
    for (const [region, w] of Object.entries(regionsFor(log.name, log.muscleGroup)) as [Region, number][]) {
      const total = RECOVERY_HOURS[region]
      if (elapsed >= total) continue
      fatigue[region] += ((log.sets * w) / SETS_FOR_FULL_FATIGUE) * (1 - elapsed / total)
      hours[region] = Math.max(hours[region], total - elapsed)
    }
  }

  return Object.fromEntries(
    ALL_REGIONS.map((r) => {
      const recovery = 1 - Math.min(1, fatigue[r])
      return [r, { recovery, hoursToFull: recovery >= 0.99 ? 0 : Math.ceil(hours[r]) }]
    })
  ) as RecoveryMap
}

// Qué tan listo está el cuerpo en general (0-100)
export function readiness(map: RecoveryMap) {
  return Math.round((ALL_REGIONS.reduce((sum, r) => sum + map[r].recovery, 0) / ALL_REGIONS.length) * 100)
}

export function recoveryColor(recovery: number) {
  if (recovery >= 0.9) return '#22c55e'
  if (recovery >= 0.7) return '#a3e635'
  if (recovery >= 0.5) return '#facc15'
  if (recovery >= 0.3) return '#f59e0b'
  return '#ef4444'
}

// Músculos que conviene dejar descansar hoy (menos del 60 %), del más cansado al menos
export function tiredRegions(map: RecoveryMap) {
  return ALL_REGIONS.filter((r) => map[r].recovery < 0.6)
    .sort((a, b) => map[a].recovery - map[b].recovery)
    .map((r) => ({ region: r, label: REGION_LABEL[r], recovery: map[r].recovery, hoursToFull: map[r].hoursToFull }))
}

export type DayOption = {
  routineId: string
  routineTitle: string
  dayId: string
  dayTitle: string
  exerciseCount: number
  readiness: number // 0-100: recuperación promedio de los músculos que trabaja
  focus: string[] // músculos principales del día
}

// Elige el día de tus rutinas cuyos músculos principales están más recuperados
export function recommendDay(routines: any[], map: RecoveryMap): DayOption | null {
  let best: DayOption | null = null
  for (const routine of routines) {
    for (const day of routine.routine_days || []) {
      const exercises = day.routine_exercises || []
      if (exercises.length === 0) continue
      const load = {} as Record<Region, number>
      for (const ex of exercises) {
        for (const [region, w] of Object.entries(regionsFor(ex.exercises?.name || '', ex.exercises?.muscle_group ?? null)) as [Region, number][]) {
          load[region] = (load[region] || 0) + w * (Number(ex.sets) || 1)
        }
      }
      const entries = Object.entries(load) as [Region, number][]
      const totalLoad = entries.reduce((s, [, v]) => s + v, 0) || 1
      const dayReadiness = Math.round((entries.reduce((s, [r, v]) => s + map[r].recovery * v, 0) / totalLoad) * 100)
      const focus = entries.sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => REGION_LABEL[r])
      const option: DayOption = {
        routineId: routine.id,
        routineTitle: routine.title,
        dayId: day.id,
        dayTitle: day.title,
        exerciseCount: exercises.length,
        readiness: dayReadiness,
        focus,
      }
      if (!best || option.readiness > best.readiness) best = option
    }
  }
  return best
}
