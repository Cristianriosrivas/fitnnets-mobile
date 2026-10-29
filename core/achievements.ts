import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase/client'

// Logros calculados en el telefono a partir de los datos que ya existen (no hay tabla de logros).
// Las fechas son las de la BD (UTC), igual que la racha del dashboard: ver US-47.

export type BadgeGroup = 'Entrenamiento' | 'Constancia' | 'Cardio' | 'Progreso' | 'Nutrición' | 'Social'
export type BadgeIcon =
  | 'footprints' | 'dumbbell' | 'medal' | 'calendar' | 'flame' | 'zap' | 'crown'
  | 'scale' | 'target' | 'pencil' | 'sparkles' | 'utensils' | 'salad' | 'trophy'
  | 'user-plus' | 'users' | 'swords' | 'route' | 'timer' | 'mountain' | 'map-pin'

export type Badge = {
  id: string
  title: string
  description: string
  group: BadgeGroup
  icon: BadgeIcon
  goal: number
  progress: number
  unlocked: boolean
}

export type AchievementStats = {
  exercisesDone: number
  trainingDays: number
  bestStreak: number
  weightLogs: number
  manualRoutines: number
  aiRoutines: number
  mealPlans: number
  perfectDays: number
  friends: number
  challengesJoined: number
  runs: number
  longestRunKm: number // la carrera más larga (solo correr), en km enteros
  totalRunKm: number // corriendo y caminando
  bestDaySteps: number
}

type Definition = Omit<Badge, 'progress' | 'unlocked'> & { value: (s: AchievementStats) => number }

const DEFINITIONS: Definition[] = [
  { id: 'primer-paso', title: 'Primer paso', description: 'Completa tu primer ejercicio', group: 'Entrenamiento', icon: 'footprints', goal: 1, value: (s) => s.exercisesDone },
  { id: 'constante', title: 'Constante', description: 'Completa 50 ejercicios', group: 'Entrenamiento', icon: 'dumbbell', goal: 50, value: (s) => s.exercisesDone },
  { id: 'maquina', title: 'Máquina', description: 'Completa 250 ejercicios', group: 'Entrenamiento', icon: 'medal', goal: 250, value: (s) => s.exercisesDone },
  { id: 'dias-10', title: 'Hábito en marcha', description: 'Entrena 10 días distintos', group: 'Entrenamiento', icon: 'calendar', goal: 10, value: (s) => s.trainingDays },
  { id: 'racha-3', title: 'En racha', description: 'Entrena 3 días seguidos', group: 'Constancia', icon: 'flame', goal: 3, value: (s) => s.bestStreak },
  { id: 'racha-7', title: 'Semana perfecta', description: 'Entrena 7 días seguidos', group: 'Constancia', icon: 'zap', goal: 7, value: (s) => s.bestStreak },
  { id: 'racha-30', title: 'Imparable', description: 'Entrena 30 días seguidos', group: 'Constancia', icon: 'crown', goal: 30, value: (s) => s.bestStreak },
  { id: 'primera-salida', title: 'Primera salida', description: 'Registra tu primera carrera o caminata', group: 'Cardio', icon: 'route', goal: 1, value: (s) => s.runs },
  { id: 'cinco-k', title: 'Cinco mil', description: 'Corre 5 km en una sola salida', group: 'Cardio', icon: 'timer', goal: 5, value: (s) => s.longestRunKm },
  { id: 'diez-k', title: 'Diez mil', description: 'Corre 10 km en una sola salida', group: 'Cardio', icon: 'mountain', goal: 10, value: (s) => s.longestRunKm },
  { id: 'km-50', title: 'Kilómetros de sobra', description: 'Acumula 50 km corriendo o caminando', group: 'Cardio', icon: 'map-pin', goal: 50, value: (s) => s.totalRunKm },
  { id: 'pasos-10k', title: 'Diez mil pasos', description: 'Camina 10.000 pasos en un día', group: 'Cardio', icon: 'footprints', goal: 10000, value: (s) => s.bestDaySteps },
  { id: 'punto-partida', title: 'Punto de partida', description: 'Registra tu peso por primera vez', group: 'Progreso', icon: 'scale', goal: 1, value: (s) => s.weightLogs },
  { id: 'seguimiento', title: 'Seguimiento fino', description: 'Registra tu peso 10 veces', group: 'Progreso', icon: 'target', goal: 10, value: (s) => s.weightLogs },
  { id: 'arquitecto', title: 'Arquitecto', description: 'Crea tu propia rutina', group: 'Progreso', icon: 'pencil', goal: 1, value: (s) => s.manualRoutines },
  { id: 'entrenador-ia', title: 'Entrenador IA', description: 'Genera una rutina con IA', group: 'Progreso', icon: 'sparkles', goal: 1, value: (s) => s.aiRoutines },
  { id: 'buen-provecho', title: 'Buen provecho', description: 'Crea tu primer plan de comidas', group: 'Nutrición', icon: 'utensils', goal: 1, value: (s) => s.mealPlans },
  { id: 'dia-perfecto', title: 'Día perfecto', description: 'Marca todas las comidas de un día', group: 'Nutrición', icon: 'salad', goal: 1, value: (s) => s.perfectDays },
  { id: 'semana-nutritiva', title: 'Semana nutritiva', description: 'Cumple 7 días tu plan completo', group: 'Nutrición', icon: 'trophy', goal: 7, value: (s) => s.perfectDays },
  { id: 'companero', title: 'Compañero', description: 'Agrega a tu primer amigo', group: 'Social', icon: 'user-plus', goal: 1, value: (s) => s.friends },
  { id: 'tribu', title: 'Tribu', description: 'Ten 5 amigos en Finnets', group: 'Social', icon: 'users', goal: 5, value: (s) => s.friends },
  { id: 'retador', title: 'Retador', description: 'Únete a un reto', group: 'Social', icon: 'swords', goal: 1, value: (s) => s.challengesJoined },
]

export const BADGE_GROUPS: BadgeGroup[] = ['Entrenamiento', 'Constancia', 'Cardio', 'Progreso', 'Nutrición', 'Social']

// Mayor cantidad de dias consecutivos con entrenamiento (fechas 'YYYY-MM-DD')
function bestStreak(dates: string[]) {
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

export async function loadAchievementStats(userId: string): Promise<AchievementStats> {
  const [logs, weights, routines, plans, friends, challenges, runs, steps] = await Promise.all([
    supabase.from('progress_logs').select('date').eq('user_id', userId),
    supabase.from('body_metrics').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('weight_kg', 'is', null),
    supabase.from('routines').select('generated_by_ai, created_by').eq('user_id', userId),
    supabase.from('meal_plans').select('id, meals(consumed)').eq('user_id', userId),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'aceptado')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase.from('challenge_participants').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    // Cardio: si estas tablas fallan, sus insignias quedan en cero sin tumbar las demás
    supabase.from('runs').select('activity, distance_m, started_at').eq('user_id', userId),
    supabase.from('daily_steps').select('steps').eq('user_id', userId).order('steps', { ascending: false }).limit(1),
  ])

  const failed = [logs, weights, routines, plans, friends, challenges].find((r) => r.error)
  if (failed?.error) throw failed.error

  const logDates = (logs.data || []).map((l) => l.date as string)
  const runRows = (runs.data || []) as { activity: string; distance_m: number; started_at: string }[]
  // Un día con carrera también es un día entrenado
  const activeDates = [...logDates, ...runRows.map((r) => r.started_at.slice(0, 10))]
  const longestRun = Math.max(0, ...runRows.filter((r) => r.activity === 'correr').map((r) => Number(r.distance_m)))
  const totalRun = runRows.reduce((sum, r) => sum + Number(r.distance_m), 0)
  const ownRoutines = routines.data || []
  const mealPlans = (plans.data || []) as { id: string; meals: { consumed: boolean }[] | null }[]

  return {
    exercisesDone: logDates.length,
    trainingDays: new Set(activeDates).size,
    bestStreak: bestStreak(activeDates),
    weightLogs: weights.count || 0,
    manualRoutines: ownRoutines.filter((r) => !r.generated_by_ai && !r.created_by).length,
    aiRoutines: ownRoutines.filter((r) => r.generated_by_ai).length,
    mealPlans: mealPlans.length,
    perfectDays: mealPlans.filter((p) => (p.meals || []).length > 0 && (p.meals || []).every((m) => m.consumed)).length,
    friends: friends.count || 0,
    challengesJoined: challenges.count || 0,
    runs: runRows.length,
    longestRunKm: Math.floor(longestRun / 1000),
    totalRunKm: Math.floor(totalRun / 1000),
    bestDaySteps: Number(steps.data?.[0]?.steps) || 0,
  }
}

export function computeBadges(stats: AchievementStats): Badge[] {
  return DEFINITIONS.map(({ value, ...def }) => {
    const raw = value(stats)
    return { ...def, progress: Math.min(raw, def.goal), unlocked: raw >= def.goal }
  })
}

const SEEN_KEY = (userId: string) => `finnets.badges.seen.${userId}`

// Devuelve las insignias desbloqueadas desde la ultima revision y las marca como vistas.
// La primera vez solo guarda el estado actual, para no avisar de golpe todo lo ya logrado.
export async function takeNewBadges(userId: string, badges: Badge[]): Promise<Badge[]> {
  const unlocked = badges.filter((b) => b.unlocked)
  const raw = await AsyncStorage.getItem(SEEN_KEY(userId))
  await AsyncStorage.setItem(SEEN_KEY(userId), JSON.stringify(unlocked.map((b) => b.id)))
  if (raw === null) return []
  const seen = new Set<string>(JSON.parse(raw))
  return unlocked.filter((b) => !seen.has(b.id))
}
