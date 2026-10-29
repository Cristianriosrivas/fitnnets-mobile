import { supabase } from './supabase/client'

// Mapa muscular: qué músculos trabaja cada ejercicio, mapa de calor de una sesión,
// evolución por músculo (volumen, progreso y rango) y comparación con un amigo.

export type Region =
  | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'traps'
  | 'lats' | 'upperBack' | 'lowerBack' | 'glutes' | 'quads' | 'hamstrings' | 'calves'

export const REGION_LABEL: Record<Region, string> = {
  chest: 'Pecho',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdomen',
  obliques: 'Oblicuos',
  traps: 'Trapecio',
  lats: 'Dorsales',
  upperBack: 'Espalda alta',
  lowerBack: 'Zona lumbar',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Femorales',
  calves: 'Pantorrillas',
}

export const ALL_REGIONS = Object.keys(REGION_LABEL) as Region[]

type Weights = Partial<Record<Region, number>>

// Músculo principal = 1, secundarios < 1. Se busca por palabra clave en el nombre del ejercicio.
const EXERCISE_REGIONS: [string, Weights][] = [
  ['press de banca', { chest: 1, triceps: 0.5, shoulders: 0.4 }],
  ['flexiones', { chest: 1, triceps: 0.5, shoulders: 0.3, abs: 0.2 }],
  ['press militar', { shoulders: 1, triceps: 0.5, traps: 0.3 }],
  ['elevaciones laterales', { shoulders: 1, traps: 0.2 }],
  ['face pull', { shoulders: 0.7, upperBack: 0.8, traps: 0.5 }],
  ['dominadas', { lats: 1, biceps: 0.6, upperBack: 0.5, forearms: 0.3 }],
  ['jalon', { lats: 1, biceps: 0.5, upperBack: 0.4 }],
  ['remo', { upperBack: 1, lats: 0.7, biceps: 0.4, lowerBack: 0.3 }],
  ['peso muerto', { hamstrings: 1, glutes: 0.9, lowerBack: 0.9, traps: 0.4, forearms: 0.4 }],
  ['hip thrust', { glutes: 1, hamstrings: 0.4 }],
  ['sentadilla bulgara', { quads: 1, glutes: 0.8, hamstrings: 0.2 }],
  ['sentadilla goblet', { quads: 1, glutes: 0.6, abs: 0.3 }],
  ['sentadilla', { quads: 1, glutes: 0.8, hamstrings: 0.3, lowerBack: 0.3 }],
  ['prensa', { quads: 1, glutes: 0.6, calves: 0.2 }],
  ['zancadas', { quads: 1, glutes: 0.7, hamstrings: 0.3, calves: 0.2 }],
  ['curl', { biceps: 1, forearms: 0.4 }],
  ['fondos', { triceps: 1, chest: 0.4, shoulders: 0.3 }],
  ['plancha', { abs: 1, obliques: 0.6, shoulders: 0.2 }],
  ['mountain climbers', { abs: 1, obliques: 0.5, shoulders: 0.4, quads: 0.3 }],
  ['burpees', { quads: 0.7, chest: 0.6, shoulders: 0.5, abs: 0.5, glutes: 0.5, calves: 0.3 }],
  ['carrera', { quads: 1, calves: 1, hamstrings: 0.6, glutes: 0.6, abs: 0.2 }],
  ['caminata', { calves: 1, quads: 0.6, glutes: 0.5, hamstrings: 0.4 }],
]

// Si el ejercicio no está en la lista (catálogo nuevo), se usa su grupo muscular
const GROUP_REGIONS: Record<string, Weights> = {
  pecho: { chest: 1, triceps: 0.3, shoulders: 0.3 },
  espalda: { lats: 1, upperBack: 0.8, lowerBack: 0.3, biceps: 0.3 },
  hombros: { shoulders: 1, traps: 0.3 },
  brazos: { biceps: 1, triceps: 1, forearms: 0.4 },
  core: { abs: 1, obliques: 0.6 },
  gluteos: { glutes: 1, hamstrings: 0.3 },
  piernas: { quads: 1, hamstrings: 0.6, glutes: 0.4, calves: 0.4 },
  cuerpo_completo: { quads: 0.5, chest: 0.5, shoulders: 0.4, abs: 0.4, lats: 0.4, glutes: 0.4 },
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function regionsFor(name: string, muscleGroup: string | null): Weights {
  const key = normalize(name)
  const match = EXERCISE_REGIONS.find(([k]) => key.includes(k))
  return match ? match[1] : GROUP_REGIONS[muscleGroup || ''] || GROUP_REGIONS.cuerpo_completo
}

// Las salidas de la tabla runs cuentan como trabajo de piernas: 1 km corriendo ≈ 1 serie y
// 1 km caminando ≈ 0,4 (máximo 12 por salida), para que sumen sin inflar el volumen.
export const RUN_EXERCISE_NAME: Record<string, string> = { correr: 'Carrera', caminar: 'Caminata' }

export function runAsSets(activity: string, meters: number) {
  const perKm = activity === 'caminar' ? 0.4 : 1
  return Math.min(12, Math.round((meters / 1000) * perKm * 10) / 10)
}

// ---------- Colores ----------

const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [42, 53, 50]],
  [0.15, [20, 184, 166]],
  [0.4, [34, 197, 94]],
  [0.6, [163, 230, 53]],
  [0.8, [245, 158, 11]],
  [1, [239, 68, 68]],
]

const hex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

// 0 = sin trabajo (gris) ... 1 = máximo (rojo): verde azulado, verde, lima, ámbar y rojo
export function heatColor(value: number) {
  const t = Math.max(0, Math.min(1, value))
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [b, cb] = HEAT_STOPS[i]
    if (t <= b) {
      const [a, ca] = HEAT_STOPS[i - 1]
      const k = (t - a) / (b - a)
      return hex(ca.map((c, j) => c + (cb[j] - c) * k))
    }
  }
  return hex(HEAT_STOPS[HEAT_STOPS.length - 1][1])
}

export type RegionTier = 'Sin entrenar' | 'Bronce' | 'Plata' | 'Oro' | 'Platino' | 'Diamante'

export const TIER_COLOR: Record<RegionTier, string> = {
  'Sin entrenar': '#2a3532',
  Bronce: '#d97706',
  Plata: '#cbd5e1',
  Oro: '#facc15',
  Platino: '#22d3ee',
  Diamante: '#a78bfa',
}

export const TIER_ORDER: RegionTier[] = ['Sin entrenar', 'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante']

export function tierFor(score: number): RegionTier {
  if (score < 5) return 'Sin entrenar'
  if (score < 25) return 'Bronce'
  if (score < 45) return 'Plata'
  if (score < 65) return 'Oro'
  if (score < 85) return 'Platino'
  return 'Diamante'
}

// ---------- Mapa de calor de una sesión ----------

export function sessionHeat(items: { name: string; muscleGroup: string | null; sets: number }[]): Record<Region, number> {
  const raw = Object.fromEntries(ALL_REGIONS.map((r) => [r, 0])) as Record<Region, number>
  for (const item of items) {
    for (const [region, w] of Object.entries(regionsFor(item.name, item.muscleGroup)) as [Region, number][]) {
      raw[region] += w * item.sets
    }
  }
  const max = Math.max(...Object.values(raw), 1)
  return Object.fromEntries(ALL_REGIONS.map((r) => [r, raw[r] / max])) as Record<Region, number>
}

// ---------- Evolución por músculo ----------

export type ExerciseStat = {
  exerciseId: string
  name: string
  muscleGroup: string | null
  setsTotal: number
  setsRecent: number // últimos 30 días
  sessions: number
  firstWeight: number | null
  lastWeight: number | null
  maxWeight: number | null
}

export type SizeChanges = Partial<Record<Region, { label: string; delta: number }>>

export type RegionStat = {
  region: Region
  label: string
  volume: number // series ponderadas, total
  recent: number // series ponderadas, últimos 30 días
  sessions: number
  strength: number | null // % de cambio de peso (primera vs última vez)
  size: { label: string; delta: number } | null // cm (solo en tu propio mapa)
  score: number // 0-100
  tier: RegionTier
  topExercise: string | null
}

export type MuscleProfile = {
  regions: Record<Region, RegionStat>
  overallScore: number
  overallTier: RegionTier
  ranked: RegionStat[] // de más a menos entrenado
}

export function buildMuscleProfile(stats: ExerciseStat[], sizes: SizeChanges = {}): MuscleProfile {
  const acc = Object.fromEntries(
    ALL_REGIONS.map((r) => [r, { volume: 0, recent: 0, sessions: 0, strengthSum: 0, strengthWeight: 0, top: null as string | null, topVolume: 0 }])
  ) as Record<Region, { volume: number; recent: number; sessions: number; strengthSum: number; strengthWeight: number; top: string | null; topVolume: number }>

  for (const s of stats) {
    const change = s.firstWeight && s.lastWeight && s.firstWeight > 0 ? (s.lastWeight - s.firstWeight) / s.firstWeight : null
    for (const [region, w] of Object.entries(regionsFor(s.name, s.muscleGroup)) as [Region, number][]) {
      const a = acc[region]
      a.volume += w * s.setsTotal
      a.recent += w * s.setsRecent
      a.sessions = Math.max(a.sessions, Math.round(s.sessions * w))
      if (change !== null && w >= 0.5) {
        a.strengthSum += change * w
        a.strengthWeight += w
      }
      if (w === 1 && s.setsTotal > a.topVolume) {
        a.top = s.name
        a.topVolume = s.setsTotal
      }
    }
  }

  const regions = Object.fromEntries(
    ALL_REGIONS.map((region) => {
      const a = acc[region]
      const strength = a.strengthWeight ? a.strengthSum / a.strengthWeight : null
      const size = sizes[region] || null
      // Volumen reciente (hasta 60) + progreso de fuerza (hasta 25) + constancia (hasta 15)
      const score = Math.round(
        Math.min(60, a.recent * 1.5) + (strength && strength > 0 ? Math.min(25, strength * 125) : 0) + Math.min(15, a.sessions * 1.5)
      )
      return [
        region,
        { region, label: REGION_LABEL[region], volume: a.volume, recent: a.recent, sessions: a.sessions, strength, size, score, tier: tierFor(score), topExercise: a.top },
      ]
    })
  ) as Record<Region, RegionStat>

  const ranked = Object.values(regions).sort((a, b) => b.score - a.score || b.volume - a.volume)
  const trained = ranked.filter((r) => r.score >= 5)
  const overallScore = trained.length ? Math.round(trained.slice(0, 8).reduce((s, r) => s + r.score, 0) / 8) : 0
  return { regions, overallScore, overallTier: tierFor(overallScore), ranked }
}

export type MapMode = 'volumen' | 'progreso' | 'rango'

// Valor 0-1 de cada músculo para pintar el modelo en el modo elegido
export function regionValues(profile: MuscleProfile, mode: MapMode): Record<Region, number> {
  const list = Object.values(profile.regions)
  if (mode === 'rango') return Object.fromEntries(list.map((r) => [r.region, r.score / 100])) as Record<Region, number>
  if (mode === 'progreso') {
    return Object.fromEntries(
      list.map((r) => {
        const strength = r.strength && r.strength > 0 ? r.strength / 0.3 : 0 // +30% = máximo
        const size = r.size && r.size.delta > 0 && r.region !== 'abs' && r.region !== 'obliques' ? r.size.delta / 4 : 0 // +4 cm = máximo
        return [r.region, Math.min(1, Math.max(strength, size))]
      })
    ) as Record<Region, number>
  }
  const max = Math.max(...list.map((r) => r.recent), 1)
  const useRecent = list.some((r) => r.recent > 0)
  const maxAll = Math.max(...list.map((r) => r.volume), 1)
  return Object.fromEntries(list.map((r) => [r.region, useRecent ? r.recent / max : r.volume / maxAll])) as Record<Region, number>
}

// ---------- Carga de datos ----------

// Tu propio historial, agregado por ejercicio en el teléfono
// includeRuns = false en la comparación con un amigo: su mapa (get_muscle_stats) solo trae gimnasio
export async function loadOwnExerciseStats(userId: string, includeRuns = true): Promise<ExerciseStat[]> {
  const { data, error } = await supabase
    .from('progress_logs')
    .select('exercise_id, sets_completed, weight_used_kg, date, exercises(name, muscle_group)')
    .eq('user_id', userId)
    .not('exercise_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(3000)
  if (error) throw error

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const map = new Map<string, ExerciseStat & { days: Set<string> }>()
  for (const row of (data || []) as any[]) {
    const id = row.exercise_id as string
    const stat = map.get(id) || {
      exerciseId: id,
      name: row.exercises?.name || 'Ejercicio',
      muscleGroup: row.exercises?.muscle_group ?? null,
      setsTotal: 0,
      setsRecent: 0,
      sessions: 0,
      firstWeight: null,
      lastWeight: null,
      maxWeight: null,
      days: new Set<string>(),
    }
    const sets = Number(row.sets_completed) || 0
    stat.setsTotal += sets
    if (row.date >= since) stat.setsRecent += sets
    stat.days.add(row.date)
    if (row.weight_used_kg !== null) {
      const w = Number(row.weight_used_kg)
      if (stat.firstWeight === null) stat.firstWeight = w
      stat.lastWeight = w
      stat.maxWeight = Math.max(stat.maxWeight ?? 0, w)
    }
    map.set(id, stat)
  }
  const gym = Array.from(map.values()).map(({ days, ...s }) => ({ ...s, sessions: days.size }))
  return includeRuns ? [...gym, ...(await loadRunStats(userId, since))] : gym
}

// Una estadística por actividad (Carrera, Caminata). Si la consulta falla, el mapa sigue con el gimnasio.
async function loadRunStats(userId: string, since: string): Promise<ExerciseStat[]> {
  const { data, error } = await supabase.from('runs').select('activity, distance_m, started_at').eq('user_id', userId).limit(1000)
  if (error || !data) return []
  const byActivity = new Map<string, ExerciseStat & { days: Set<string> }>()
  for (const r of data as { activity: string; distance_m: number; started_at: string }[]) {
    const stat = byActivity.get(r.activity) || {
      exerciseId: 'run-' + r.activity,
      name: RUN_EXERCISE_NAME[r.activity] || 'Carrera',
      muscleGroup: 'piernas',
      setsTotal: 0,
      setsRecent: 0,
      sessions: 0,
      firstWeight: null,
      lastWeight: null,
      maxWeight: null,
      days: new Set<string>(),
    }
    const sets = runAsSets(r.activity, Number(r.distance_m))
    const day = r.started_at.slice(0, 10)
    stat.setsTotal += sets
    if (day >= since) stat.setsRecent += sets
    stat.days.add(day)
    byActivity.set(r.activity, stat)
  }
  return Array.from(byActivity.values()).map(({ days, ...s }) => ({ ...s, sessions: days.size }))
}

// Cambios de medidas (primera vs última), solo para tu propio mapa: son datos de salud
export async function loadSizeChanges(userId: string): Promise<SizeChanges> {
  const { data } = await supabase
    .from('body_metrics')
    .select('date, chest_cm, bicep_cm, thigh_cm, glute_cm, waist_cm')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  const rows = (data || []) as Record<string, number | string | null>[]
  const delta = (field: string) => {
    const values = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined).map(Number)
    return values.length >= 2 ? Math.round((values[values.length - 1] - values[0]) * 10) / 10 : null
  }
  const sizes: SizeChanges = {}
  const put = (regions: Region[], label: string, value: number | null) => {
    if (value === null) return
    for (const r of regions) sizes[r] = { label, delta: value }
  }
  put(['chest'], 'Pecho', delta('chest_cm'))
  put(['biceps', 'triceps'], 'Brazo', delta('bicep_cm'))
  put(['quads', 'hamstrings'], 'Muslo', delta('thigh_cm'))
  put(['glutes'], 'Glúteo', delta('glute_cm'))
  put(['abs', 'obliques'], 'Cintura', delta('waist_cm'))
  return sizes
}

export type FriendStatsResult =
  | { status: 'ok'; stats: ExerciseStat[] }
  | { status: 'not_shared' | 'not_friends' | 'unavailable' | 'error' }

// Historial de un amigo: lo agrega la función get_muscle_stats en la BD, que solo responde si
// son amigos aceptados y el amigo activó "Compartir mi mapa muscular" (sin medidas corporales)
export async function loadFriendExerciseStats(friendId: string): Promise<FriendStatsResult> {
  const { data, error } = await supabase.rpc('get_muscle_stats', { p_user_id: friendId })
  if (error) {
    const message = (error.message || '').toLowerCase()
    if (error.code === 'PGRST202' || error.code === '42883') return { status: 'unavailable' }
    if (message.includes('comparte')) return { status: 'not_shared' }
    if (message.includes('amigos')) return { status: 'not_friends' }
    return { status: 'error' }
  }
  return {
    status: 'ok',
    stats: ((data || []) as any[]).map((r) => ({
      exerciseId: r.exercise_id,
      name: r.name,
      muscleGroup: r.muscle_group,
      setsTotal: Number(r.sets_total) || 0,
      setsRecent: Number(r.sets_recent) || 0,
      sessions: Number(r.sessions) || 0,
      firstWeight: r.first_weight === null ? null : Number(r.first_weight),
      lastWeight: r.last_weight === null ? null : Number(r.last_weight),
      maxWeight: r.max_weight === null ? null : Number(r.max_weight),
    })),
  }
}

// Quién domina cada músculo (diferencia de al menos 10 puntos)
export function compareProfiles(mine: MuscleProfile, theirs: MuscleProfile) {
  const mineWins: RegionStat[] = []
  const theirWins: RegionStat[] = []
  for (const region of ALL_REGIONS) {
    const diff = mine.regions[region].score - theirs.regions[region].score
    if (diff >= 10) mineWins.push(mine.regions[region])
    else if (diff <= -10) theirWins.push(theirs.regions[region])
  }
  mineWins.sort((a, b) => b.score - a.score)
  theirWins.sort((a, b) => b.score - a.score)
  return { mineWins, theirWins }
}
