import { supabase } from './supabase/client'
import { averageReps } from './training'
import { REGION_LABEL, RUN_EXERCISE_NAME, Region, runAsSets, sessionHeat } from './muscles'

// "Finnets Wrapped": tu último mes resumido en datos fáciles de presumir.

export type WrappedData = {
  workouts: number
  totalSets: number
  totalMinutes: number
  volumeKg: number
  equivalence: { emoji: string; amount: string; thing: string }
  bestStreak: number
  topExercise: { name: string; sets: number } | null
  bestProgress: { name: string; from: number; to: number } | null
  topMuscle: { label: string; share: number } | null
  heat: Record<Region, number>
  timeOfDay: { label: string; emoji: string; hour: number } | null
  weightChange: number | null
  cardio: { km: number; outings: number; minutes: number } | null
}

const fmt = (n: number, decimals = 1) => (Math.round(n * 10 ** decimals) / 10 ** decimals).toString().replace('.', ',')

// Para que el volumen se entienda: elefantes, autos, pianos o perros
function equivalence(volumeKg: number) {
  if (volumeKg >= 6000) return { emoji: '🐘', amount: fmt(volumeKg / 6000), thing: 'elefantes africanos' }
  if (volumeKg >= 1500) return { emoji: '🚗', amount: fmt(volumeKg / 1500), thing: 'autos' }
  if (volumeKg >= 450) return { emoji: '🎹', amount: fmt(volumeKg / 450), thing: 'pianos de cola' }
  return { emoji: '🐕', amount: fmt(volumeKg / 30), thing: 'perros golden' }
}

function timeOfDay(hours: number[]) {
  if (hours.length === 0) return null
  const buckets = [
    { label: 'madrugador', emoji: '🌅', from: 4, to: 11 },
    { label: 'de mediodía', emoji: '☀️', from: 11, to: 15 },
    { label: 'de la tarde', emoji: '🌇', from: 15, to: 20 },
    { label: 'nocturno', emoji: '🌙', from: 20, to: 28 },
  ]
  const bucketOf = (h: number) => buckets.find((b) => (h < 4 ? h + 24 : h) >= b.from && (h < 4 ? h + 24 : h) < b.to) || buckets[3]
  const counts = new Map<string, number>()
  for (const h of hours) counts.set(bucketOf(h).label, (counts.get(bucketOf(h).label) || 0) + 1)
  const winner = buckets.reduce((a, b) => ((counts.get(b.label) || 0) > (counts.get(a.label) || 0) ? b : a))
  // Hora más frecuente dentro de esa franja
  const inBucket = hours.filter((h) => bucketOf(h).label === winner.label)
  const hourCounts = new Map<number, number>()
  for (const h of inBucket) hourCounts.set(h, (hourCounts.get(h) || 0) + 1)
  const hour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? inBucket[0]
  return { label: winner.label, emoji: winner.emoji, hour }
}

function longestStreak(dates: string[]) {
  const days = Array.from(new Set(dates)).sort()
  let best = 0
  let current = 0
  let previous: number | null = null
  for (const d of days) {
    const time = Date.parse(d + 'T00:00:00Z')
    current = previous !== null && time - previous === 86400000 ? current + 1 : 1
    best = Math.max(best, current)
    previous = time
  }
  return best
}

export async function loadWrapped(userId: string): Promise<WrappedData> {
  const since = new Date(Date.now() - 30 * 86400000)
  const sinceDate = since.toISOString().slice(0, 10)
  const [{ data: logs, error }, { data: metrics }, { data: runData }] = await Promise.all([
    supabase
      .from('progress_logs')
      .select('sets_completed, reps_completed, weight_used_kg, duration_seconds, date, created_at, exercises(name, muscle_group)')
      .eq('user_id', userId)
      .gte('date', sinceDate)
      .order('created_at', { ascending: true }),
    supabase.from('body_metrics').select('date, weight_kg').eq('user_id', userId).gte('date', sinceDate).not('weight_kg', 'is', null).order('date'),
    supabase.from('runs').select('activity, distance_m, duration_seconds, started_at').eq('user_id', userId).gte('started_at', since.toISOString()),
  ])
  if (error) throw error
  const rows = (logs || []) as any[]
  const runs = (runData || []) as { activity: string; distance_m: number; duration_seconds: number; started_at: string }[]
  const runDates = runs.map((r) => r.started_at.slice(0, 10))
  const runSeconds = runs.reduce((s, r) => s + (Number(r.duration_seconds) || 0), 0)
  const runKm = runs.reduce((s, r) => s + Number(r.distance_m) / 1000, 0)

  let totalSets = 0
  let volumeKg = 0
  let seconds = 0
  const setsByExercise = new Map<string, number>()
  const weightsByExercise = new Map<string, number[]>()
  for (const r of rows) {
    const name = r.exercises?.name || 'Ejercicio'
    const sets = Number(r.sets_completed) || 0
    totalSets += sets
    seconds += Number(r.duration_seconds) || 0
    setsByExercise.set(name, (setsByExercise.get(name) || 0) + sets)
    if (r.weight_used_kg !== null) {
      const w = Number(r.weight_used_kg)
      volumeKg += w * sets * averageReps(r.reps_completed || '')
      weightsByExercise.set(name, [...(weightsByExercise.get(name) || []), w])
    }
  }

  const topEntry = Array.from(setsByExercise.entries()).sort((a, b) => b[1] - a[1])[0]
  let bestProgress: WrappedData['bestProgress'] = null
  for (const [name, weights] of weightsByExercise) {
    const from = weights[0]
    const to = Math.max(...weights)
    if (to > from && (!bestProgress || to / from > bestProgress.to / bestProgress.from)) bestProgress = { name, from, to }
  }

  const heat = sessionHeat([
    ...rows.map((r) => ({ name: r.exercises?.name || '', muscleGroup: r.exercises?.muscle_group ?? null, sets: Number(r.sets_completed) || 0 })),
    ...runs.map((r) => ({ name: RUN_EXERCISE_NAME[r.activity] || 'Carrera', muscleGroup: 'piernas', sets: runAsSets(r.activity, Number(r.distance_m)) })),
  ])
  const rawByRegion = new Map<Region, number>()
  for (const [region, value] of Object.entries(heat) as [Region, number][]) rawByRegion.set(region, value)
  const totalHeat = Array.from(rawByRegion.values()).reduce((a, b) => a + b, 0) || 1
  const topRegion = Array.from(rawByRegion.entries()).sort((a, b) => b[1] - a[1])[0]

  const weights = ((metrics || []) as { weight_kg: number }[]).map((m) => Number(m.weight_kg))

  return {
    workouts: new Set([...rows.map((r) => r.date), ...runDates]).size,
    totalSets,
    totalMinutes: Math.round((seconds + runSeconds) / 60),
    volumeKg: Math.round(volumeKg),
    equivalence: equivalence(volumeKg),
    bestStreak: longestStreak([...rows.map((r) => r.date), ...runDates]),
    topExercise: topEntry ? { name: topEntry[0], sets: topEntry[1] } : null,
    bestProgress,
    topMuscle: topRegion && topRegion[1] > 0 ? { label: REGION_LABEL[topRegion[0]], share: topRegion[1] / totalHeat } : null,
    heat,
    timeOfDay: timeOfDay(rows.map((r) => new Date(r.created_at).getHours())),
    weightChange: weights.length >= 2 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : null,
    cardio: runs.length ? { km: Math.round(runKm * 10) / 10, outings: runs.length, minutes: Math.round(runSeconds / 60) } : null,
  }
}

// La distancia del mes comparada con algo conocido
export function cardioEquivalence(km: number) {
  const marathons = km / 42.195
  if (marathons >= 1.05) return 'Equivale a ' + fmt(marathons) + ' maratones'
  if (marathons >= 1) return 'Es una maratón completa'
  if (km >= 21.1) return 'Más que una media maratón'
  if (km >= 10) return 'Más que una carrera de 10K'
  return 'Son ' + Math.max(1, Math.round((km * 1000) / 400)) + ' vueltas a una pista de atletismo'
}

export function wrappedShareText(data: WrappedData, username: string) {
  const lines = [
    `Mi último mes en Finnets 💪${username ? ' (' + username + ')' : ''}`,
    `🗓️ ${data.workouts} días entrenados${data.totalMinutes ? ' · ' + data.totalMinutes + ' min' : ''}`,
  ]
  if (data.volumeKg) lines.push(`🏋️ ${data.volumeKg.toLocaleString('es-CO')} kg levantados: ${data.equivalence.amount} ${data.equivalence.thing} ${data.equivalence.emoji}`)
  if (data.cardio) lines.push(`🏃 ${fmt(data.cardio.km)} km recorridos en ${data.cardio.outings} ${data.cardio.outings === 1 ? 'salida' : 'salidas'}`)
  if (data.topMuscle) lines.push(`⭐ Músculo estrella: ${data.topMuscle.label}`)
  if (data.bestProgress) lines.push(`📈 ${data.bestProgress.name}: ${data.bestProgress.from} → ${data.bestProgress.to} kg`)
  if (data.bestStreak > 1) lines.push(`🔥 Racha de ${data.bestStreak} días seguidos`)
  lines.push('#Finnets')
  return lines.join('\n')
}
