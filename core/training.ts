import { supabase } from './supabase/client'

// Registro de entrenamiento: peso, tiempo, recomendación de peso, rango y resumen.
// Todo se calcula en el teléfono con reglas fijas (no gasta cuota de IA).

export type ExerciseInfo = {
  exerciseId: string
  name: string
  muscleGroup: string | null
  equipment: string | null
  difficulty: string | null
}

export type TrainingProfile = {
  weightKg: number | null
  gender: string | null
  goal: string | null
  activityLevel: string | null
}

export type WeightEntry = { weight: number; date: string }
export type WeightHistory = Record<string, WeightEntry[]> // por exerciseId, más reciente primero

// ---------- Compatibilidad con la migración 20261028_peso_tiempo_entrenamiento ----------
// Hasta que se aplique, progress_logs no tiene exercise_id ni duration_seconds: la app lo detecta
// con el primer error de "columna inexistente" y sigue con las columnas que sí existen.
let hasV2Columns: boolean | null = null

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || /column|could not find/i.test(error.message || '')
}

export async function saveExerciseLog(entry: {
  userId: string
  routineExerciseId: string
  exerciseId: string
  sets: number
  reps: string
  weightKg: number | null
  durationSeconds: number
}): Promise<boolean> {
  const base = {
    user_id: entry.userId,
    routine_exercise_id: entry.routineExerciseId,
    sets_completed: entry.sets,
    reps_completed: entry.reps,
    weight_used_kg: entry.weightKg,
  }
  if (hasV2Columns !== false) {
    const { error } = await supabase
      .from('progress_logs')
      .insert({ ...base, exercise_id: entry.exerciseId, duration_seconds: entry.durationSeconds })
    if (!error) {
      hasV2Columns = true
      return true
    }
    if (!isMissingColumn(error)) return false
    hasV2Columns = false
  }
  const { error } = await supabase.from('progress_logs').insert(base)
  return !error
}

type LogRow = { weight_used_kg: number | null; date: string; exercise_id?: string | null; routine_exercises?: { exercise_id: string } | null }

function groupHistory(rows: LogRow[], idOf: (r: LogRow) => string | null | undefined): WeightHistory {
  const history: WeightHistory = {}
  for (const row of rows) {
    const id = idOf(row)
    if (!id || row.weight_used_kg === null) continue
    ;(history[id] ||= []).push({ weight: Number(row.weight_used_kg), date: row.date })
  }
  return history
}

// Pesos registrados por ejercicio (para "Última vez" y la recomendación)
export async function loadWeightHistory(userId: string, exerciseIds: string[]): Promise<WeightHistory> {
  if (exerciseIds.length === 0) return {}
  if (hasV2Columns !== false) {
    const { data, error } = await supabase
      .from('progress_logs')
      .select('exercise_id, weight_used_kg, date')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)
      .not('weight_used_kg', 'is', null)
      .order('created_at', { ascending: false })
      .limit(400)
    if (!error) {
      hasV2Columns = true
      return groupHistory((data || []) as LogRow[], (r) => r.exercise_id)
    }
    if (!isMissingColumn(error)) return {}
    hasV2Columns = false
  }
  // Sin la migración: se llega al ejercicio por routine_exercises (se pierde si la rutina se borró)
  const { data } = await supabase
    .from('progress_logs')
    .select('weight_used_kg, date, routine_exercises!inner(exercise_id)')
    .eq('user_id', userId)
    .in('routine_exercises.exercise_id', exerciseIds)
    .not('weight_used_kg', 'is', null)
    .order('created_at', { ascending: false })
    .limit(400)
  return groupHistory((data || []) as unknown as LogRow[], (r) => r.routine_exercises?.exercise_id)
}

export type StrengthSeries = { exerciseId: string; name: string; points: WeightEntry[] } // puntos de más antiguo a más reciente

// Evolución del peso levantado por ejercicio (pantalla Progreso)
export async function loadStrengthSeries(userId: string): Promise<StrengthSeries[]> {
  let rows: { id: string | undefined; name: string | undefined; weight: number; date: string }[] = []

  if (hasV2Columns !== false) {
    const { data, error } = await supabase
      .from('progress_logs')
      .select('weight_used_kg, date, exercise_id, exercises(name)')
      .eq('user_id', userId)
      .not('weight_used_kg', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (!error) {
      hasV2Columns = true
      rows = (data || []).map((r: any) => ({ id: r.exercise_id, name: r.exercises?.name, weight: Number(r.weight_used_kg), date: r.date }))
    } else if (isMissingColumn(error)) {
      hasV2Columns = false
    } else {
      throw error
    }
  }
  if (hasV2Columns === false) {
    const { data, error } = await supabase
      .from('progress_logs')
      .select('weight_used_kg, date, routine_exercises!inner(exercise_id, exercises(name))')
      .eq('user_id', userId)
      .not('weight_used_kg', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (error) throw error
    rows = (data || []).map((r: any) => ({
      id: r.routine_exercises?.exercise_id,
      name: r.routine_exercises?.exercises?.name,
      weight: Number(r.weight_used_kg),
      date: r.date,
    }))
  }

  // Un punto por día: el mayor peso de ese día
  const byExercise = new Map<string, StrengthSeries>()
  for (const r of rows) {
    if (!r.id || !r.name) continue
    const series = byExercise.get(r.id) || { exerciseId: r.id, name: r.name, points: [] }
    const last = series.points[series.points.length - 1]
    if (last && last.date === r.date) last.weight = Math.max(last.weight, r.weight)
    else series.points.push({ weight: r.weight, date: r.date })
    byExercise.set(r.id, series)
  }
  return Array.from(byExercise.values()).sort((a, b) => b.points.length - a.points.length)
}

// ---------- Recomendación de peso (sobrecarga progresiva) ----------

export type Recommendation = {
  kind: 'subir' | 'mantener' | 'inicial' | 'corporal'
  weightKg: number | null
  lastWeight: number | null
  message: string
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function isBodyweight(ex: ExerciseInfo) {
  return !ex.equipment || ex.equipment === 'ninguno'
}

// Incremento mínimo razonable según el equipo y el músculo
function weightStep(ex: ExerciseInfo) {
  if (ex.equipment === 'mancuernas') return 1
  const lower = ex.muscleGroup === 'piernas' || ex.muscleGroup === 'gluteos' || normalize(ex.name).includes('peso muerto')
  return lower ? 5 : 2.5
}

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step)

// Proporción del peso corporal para series de 8-12 repeticiones de un principiante
// (en mancuernas, por mancuerna). Es una estimación de arranque, no una prescripción.
const START_RATIOS: [string, number][] = [
  ['peso muerto', 0.7],
  ['sentadilla goblet', 0.15],
  ['sentadilla', 0.6],
  ['press de banca', 0.5],
  ['press militar', 0.3],
  ['remo', 0.4],
  ['hip thrust', 0.7],
  ['prensa', 1.2],
  ['jalon', 0.45],
  ['face pull', 0.15],
  ['curl', 0.08],
  ['elevaciones laterales', 0.04],
]

function startingRatio(ex: ExerciseInfo) {
  const name = normalize(ex.name)
  const match = START_RATIOS.find(([key]) => name.includes(key))
  if (match) return match[1]
  if (ex.equipment === 'mancuernas') return 0.1
  return 0.4
}

const ACTIVITY_FACTOR: Record<string, number> = { sedentario: 0.8, ligero: 0.9, moderado: 1, intenso: 1.15 }
const GOAL_FACTOR: Record<string, number> = { ganar_musculo: 1, mantenimiento: 0.95, perder_grasa: 0.85, resistencia: 0.8 }

// Peso por sesión (el mayor de cada día), de la más reciente a la más antigua
function sessionWeights(history: WeightEntry[]) {
  const byDate = new Map<string, number>()
  for (const h of history) byDate.set(h.date, Math.max(byDate.get(h.date) ?? 0, h.weight))
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, w]) => w)
}

export function recommendWeight(ex: ExerciseInfo, history: WeightEntry[], profile: TrainingProfile): Recommendation {
  const sessions = sessionWeights(history)
  const last = sessions[0] ?? null

  if (isBodyweight(ex)) {
    return {
      kind: 'corporal',
      weightKg: last,
      lastWeight: last,
      message: last
        ? `Última vez con ${last} kg de lastre. Si sale fácil, súmale repeticiones.`
        : 'Con tu peso corporal. Si sale fácil, suma repeticiones o agrega lastre.',
    }
  }

  const step = weightStep(ex)
  if (last !== null) {
    // Doble sesión con el mismo peso = ya está consolidado: toca subir
    if (sessions.length >= 2 && sessions[1] === last) {
      const next = roundTo(last + step, step)
      return { kind: 'subir', weightKg: next, lastWeight: last, message: `Llevas 2 sesiones con ${last} kg: prueba con ${next} kg.` }
    }
    return { kind: 'mantener', weightKg: last, lastWeight: last, message: `Repite ${last} kg para consolidar; la próxima subimos.` }
  }

  const bodyweight = profile.weightKg && profile.weightKg > 30 ? profile.weightKg : 70
  const genderFactor = profile.gender === 'femenino' ? 0.65 : 1
  const activity = ACTIVITY_FACTOR[profile.activityLevel || ''] ?? 0.9
  const goal = GOAL_FACTOR[profile.goal || ''] ?? 0.95
  const technique = ex.difficulty === 'avanzado' ? 0.85 : 1
  const estimate = roundTo(bodyweight * startingRatio(ex) * genderFactor * activity * goal * technique, step)
  return {
    kind: 'inicial',
    weightKg: estimate,
    lastWeight: null,
    message: 'Peso de arranque según tu perfil. Si las últimas repeticiones no cuestan, súbelo.',
  }
}

export function parseWeight(text: string): number | null {
  const value = parseFloat(text.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}

export function weightStepFor(ex: ExerciseInfo) {
  return isBodyweight(ex) ? 2.5 : weightStep(ex)
}

// ---------- Resultado del entrenamiento: rango y resumen ----------

export type ExerciseResult = {
  exercise: ExerciseInfo
  sets: number
  reps: string
  restSeconds: number
  weightKg: number | null
  durationSeconds: number
  previous: WeightEntry[] // historial ANTES de esta sesión
}

export type RankTier = 'Bronce' | 'Plata' | 'Oro' | 'Platino' | 'Diamante'

export type WorkoutReport = {
  score: number
  tier: RankTier
  reasons: string[]
  totalSeconds: number
  estimatedSeconds: number
  volumeKg: number
  previousVolumeKg: number | null
  personalRecords: string[]
  calories: number
  muscles: { group: string; label: string; sets: number; share: number }[]
  purpose: string
}

// "10-12" -> 11, "15" -> 15, "30s" o "al fallo" -> 10
export function averageReps(reps: string) {
  const numbers = (reps.match(/\d+/g) || []).map(Number)
  if (numbers.length === 0 || /s\b|seg/i.test(reps)) return 10
  return numbers.reduce((a, b) => a + b, 0) / numbers.length
}

const MUSCLES: Record<string, { label: string; benefit: string }> = {
  pecho: { label: 'Pecho', benefit: 'la fuerza de empuje del tren superior' },
  espalda: { label: 'Espalda', benefit: 'la postura y la fuerza de tracción' },
  piernas: { label: 'Piernas', benefit: 'la fuerza, la potencia y el gasto calórico' },
  gluteos: { label: 'Glúteos', benefit: 'la potencia de cadera y la estabilidad' },
  hombros: { label: 'Hombros', benefit: 'la estabilidad y la movilidad del hombro' },
  brazos: { label: 'Brazos', benefit: 'el bíceps, el tríceps y el agarre' },
  core: { label: 'Core', benefit: 'la estabilidad del tronco y la protección lumbar' },
  cuerpo_completo: { label: 'Cuerpo completo', benefit: 'el acondicionamiento y la resistencia general' },
}

export function muscleLabel(group: string | null) {
  return MUSCLES[group || '']?.label || 'General'
}

const GOAL_LINES: Record<string, (r: { volumeKg: number; calories: number }) => string> = {
  ganar_musculo: (r) =>
    `Para ganar músculo lo que más cuenta es subir poco a poco el peso o las repeticiones${r.volumeKg ? `: hoy moviste ${Math.round(r.volumeKg).toLocaleString('es-CO')} kg en total` : ''}.`,
  perder_grasa: (r) =>
    `Para perder grasa, mantener la fuerza mientras cuidas la alimentación es clave; esta sesión quemó cerca de ${r.calories} kcal.`,
  mantenimiento: () => 'Para mantenerte, la constancia vale más que el récord: esta sesión ya suma a tu racha.',
  resistencia: () => 'Para tu resistencia, completar el bloque con descansos cortos mejora tu capacidad de trabajo.',
}

export function buildWorkoutReport(results: ExerciseResult[], totalSeconds: number, profile: TrainingProfile): WorkoutReport {
  const volumeOf = (weight: number | null, r: ExerciseResult) => (weight ? weight * r.sets * averageReps(r.reps) : 0)

  const volumeKg = results.reduce((sum, r) => sum + volumeOf(r.weightKg, r), 0)
  const comparable = results.filter((r) => r.weightKg && r.previous.length)
  const previousVolumeKg = comparable.length
    ? comparable.reduce((sum, r) => sum + volumeOf(r.previous[0].weight, r), 0)
    : null
  const currentComparable = comparable.reduce((sum, r) => sum + volumeOf(r.weightKg, r), 0)

  const personalRecords = results
    .filter((r) => r.weightKg && r.previous.length && r.weightKg > Math.max(...r.previous.map((p) => p.weight)))
    .map((r) => r.exercise.name)

  // Tiempo esperado: ~45 s por serie más los descansos programados
  const estimatedSeconds = results.reduce((sum, r) => sum + r.sets * (45 + r.restSeconds), 0)

  let score = 50
  const reasons: string[] = ['Completaste todo el entrenamiento']

  if (previousVolumeKg && previousVolumeKg > 0) {
    const change = (currentComparable - previousVolumeKg) / previousVolumeKg
    if (change >= 0.05) {
      score += 20
      reasons.push(`Volumen +${Math.round(change * 100)}% respecto a la última vez`)
    } else if (change >= 0) {
      score += 12
      reasons.push('Mantuviste el volumen de la última vez')
    } else {
      score += 5
      reasons.push(`Volumen ${Math.round(change * 100)}% respecto a la última vez`)
    }
  } else {
    score += 10
    reasons.push('Primera vez con estos pesos: ya tienes punto de partida')
  }

  if (personalRecords.length) {
    score += Math.min(15, personalRecords.length * 5)
    reasons.push(`${personalRecords.length} ${personalRecords.length === 1 ? 'récord personal' : 'récords personales'}`)
  }

  const pace = estimatedSeconds ? totalSeconds / estimatedSeconds : 1
  if (pace <= 1) {
    score += 15
    reasons.push('Ritmo excelente: dentro del tiempo esperado')
  } else if (pace <= 1.3) {
    score += 10
    reasons.push('Buen ritmo de trabajo')
  } else {
    score += 4
    reasons.push('Descansos largos: intenta respetar el cronómetro')
  }

  score = Math.min(100, score)
  const tier: RankTier = score >= 90 ? 'Diamante' : score >= 80 ? 'Platino' : score >= 70 ? 'Oro' : score >= 60 ? 'Plata' : 'Bronce'

  // Gasto aproximado: MET 5 (fuerza moderada) x peso corporal x horas
  const calories = Math.round(5 * (profile.weightKg || 70) * (totalSeconds / 3600))

  const setsByGroup = new Map<string, number>()
  for (const r of results) {
    const group = r.exercise.muscleGroup || 'cuerpo_completo'
    setsByGroup.set(group, (setsByGroup.get(group) || 0) + r.sets)
  }
  const totalSets = Array.from(setsByGroup.values()).reduce((a, b) => a + b, 0) || 1
  const muscles = Array.from(setsByGroup.entries())
    .map(([group, sets]) => ({ group, label: muscleLabel(group), sets, share: sets / totalSets }))
    .sort((a, b) => b.sets - a.sets)

  const top = muscles.slice(0, 2)
  const focus =
    top.length === 0
      ? ''
      : top.length === 1
        ? `Trabajaste sobre todo ${top[0].label.toLowerCase()}, que desarrolla ${MUSCLES[top[0].group]?.benefit || 'tu condición general'}.`
        : `Trabajaste sobre todo ${top[0].label.toLowerCase()} y ${top[1].label.toLowerCase()}: mejoran ${MUSCLES[top[0].group]?.benefit || 'tu condición'} y ${MUSCLES[top[1].group]?.benefit || 'tu condición general'}.`
  const goalLine = GOAL_LINES[profile.goal || '']?.({ volumeKg, calories }) || ''

  return {
    score,
    tier,
    reasons,
    totalSeconds,
    estimatedSeconds,
    volumeKg,
    previousVolumeKg,
    personalRecords,
    calories,
    muscles,
    purpose: [focus, goalLine].filter(Boolean).join(' '),
  }
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
