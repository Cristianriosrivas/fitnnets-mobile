import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase/client'
import type { RankTier } from './training'

// Carreras con GPS: distancia, filtros de calidad, ritmo, parciales, calorías, récords y rango.
// La ruta (coordenadas) se queda SOLO en el teléfono; a la base de datos van totales.

export type Activity = 'correr' | 'caminar'
export type GeoPoint = { lat: number; lng: number; t: number }
export type LatLng = [number, number]

// Distancia en metros entre dos coordenadas (haversine)
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ---------- Filtro de calidad del GPS ----------
export const GOOD_ACCURACY_M = 15
const MAX_ACCURACY_M = 25 // lecturas menos precisas se descartan
const MIN_MOVE_M = 3 // por debajo es ruido del GPS estando quieto
const MAX_SPEED_MS: Record<Activity, number> = { correr: 8.5, caminar: 3.5 } // 30,6 y 12,6 km/h

// Decide si un punto nuevo cuenta y cuántos metros suma
export function acceptPoint(prev: GeoPoint | null, next: GeoPoint, accuracy: number | null, activity: Activity) {
  if (accuracy !== null && accuracy > MAX_ACCURACY_M) return { accept: false, meters: 0 }
  if (!prev) return { accept: true, meters: 0 }
  const seconds = (next.t - prev.t) / 1000
  if (seconds <= 0) return { accept: false, meters: 0 }
  const meters = haversine(prev, next)
  if (meters < MIN_MOVE_M) return { accept: false, meters: 0 }
  if (meters / seconds > MAX_SPEED_MS[activity]) return { accept: false, meters: 0 }
  return { accept: true, meters }
}

export function gpsQuality(accuracy: number | null): { label: string; color: string } {
  if (accuracy === null) return { label: 'Buscando señal GPS…', color: '#6b7876' }
  if (accuracy <= GOOD_ACCURACY_M) return { label: `Señal GPS buena (±${Math.round(accuracy)} m)`, color: '#22c55e' }
  if (accuracy <= MAX_ACCURACY_M) return { label: `Señal GPS regular (±${Math.round(accuracy)} m)`, color: '#facc15' }
  return { label: `Señal GPS débil (±${Math.round(accuracy)} m): sal a cielo abierto`, color: '#ef4444' }
}

// ---------- Formatos ----------
export function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm) || secondsPerKm > 3600) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, '0')}`
}

export const formatKm = (meters: number, decimals = 2) => (meters / 1000).toFixed(decimals).replace('.', ',')

// Ritmo actual: metros y segundos de los últimos ~30 s (suaviza los saltos del GPS)
export function currentPace(track: { t: number; d: number }[]) {
  if (track.length < 2) return null
  const last = track[track.length - 1]
  let first = track[track.length - 2]
  for (let i = track.length - 2; i >= 0; i--) {
    first = track[i]
    if (last.t - track[i].t >= 30000) break
  }
  const meters = last.d - first.d
  const seconds = (last.t - first.t) / 1000
  if (meters < 15 || seconds <= 0) return null
  return seconds / (meters / 1000)
}

// ~1 kcal por kg y km corriendo; ~0,55 caminando
export function runCalories(weightKg: number | null, meters: number, activity: Activity) {
  return Math.round((weightKg && weightKg > 30 ? weightKg : 70) * (meters / 1000) * (activity === 'correr' ? 1 : 0.55))
}

// ---------- Guardar y leer ----------
export type RunRecord = {
  id: string
  activity: Activity
  started_at: string
  duration_seconds: number
  distance_m: number
  avg_pace_seconds: number | null
  best_km_seconds: number | null
  splits_seconds: number[] | null
  steps: number | null
  calories: number | null
}

export async function saveRun(userId: string, run: Omit<RunRecord, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('runs')
    .insert({ user_id: userId, ...run })
    .select('id')
    .single()
  return error ? null : (data.id as string)
}

export async function loadRuns(userId: string, limit = 300): Promise<RunRecord[]> {
  const { data, error } = await supabase
    .from('runs')
    .select('id, activity, started_at, duration_seconds, distance_m, avg_pace_seconds, best_km_seconds, splits_seconds, steps, calories')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data || []) as any[]).map((r) => ({ ...r, distance_m: Number(r.distance_m) }))
}

// ---------- Ruta local (solo en este teléfono) ----------
const ROUTE_KEY = (runId: string) => `finnets.route.${runId}`
const ROUTE_INDEX_KEY = 'finnets.routes.index'
const MAX_STORED_ROUTES = 40

// Reduce la ruta a puntos separados al menos ~8 m y como máximo maxPoints
export function simplifyRoute(points: GeoPoint[], maxPoints = 400): LatLng[] {
  const kept: GeoPoint[] = []
  for (const p of points) {
    const last = kept[kept.length - 1]
    if (!last || haversine(last, p) >= 8) kept.push(p)
  }
  if (points.length && kept[kept.length - 1] !== points[points.length - 1]) kept.push(points[points.length - 1])
  const step = Math.max(1, Math.ceil(kept.length / maxPoints))
  return kept.filter((_, i) => i % step === 0 || i === kept.length - 1).map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6])
}

export async function saveRouteLocally(runId: string, route: LatLng[]) {
  try {
    await AsyncStorage.setItem(ROUTE_KEY(runId), JSON.stringify(route))
    const index: string[] = JSON.parse((await AsyncStorage.getItem(ROUTE_INDEX_KEY)) || '[]')
    const next = [runId, ...index.filter((id) => id !== runId)]
    await AsyncStorage.setItem(ROUTE_INDEX_KEY, JSON.stringify(next.slice(0, MAX_STORED_ROUTES)))
    await Promise.all(next.slice(MAX_STORED_ROUTES).map((id) => AsyncStorage.removeItem(ROUTE_KEY(id))))
  } catch {
    // Si no hay espacio, la carrera igual queda guardada (sin el dibujo de la ruta)
  }
}

export async function loadRouteLocally(runId: string): Promise<LatLng[] | null> {
  try {
    const raw = await AsyncStorage.getItem(ROUTE_KEY(runId))
    return raw ? (JSON.parse(raw) as LatLng[]) : null
  } catch {
    return null
  }
}

// ---------- Récords y rango ----------
export type RunRecords = {
  best1k: number | null // segundos
  best5k: number | null
  best10k: number | null
  longest: number | null // metros
}

// Mejor tramo de n km seguidos dentro de los parciales de cada carrera
function bestWindow(runs: RunRecord[], km: number) {
  let best: number | null = null
  for (const r of runs) {
    const splits = r.splits_seconds || []
    for (let i = 0; i + km <= splits.length; i++) {
      const total = splits.slice(i, i + km).reduce((a, b) => a + b, 0)
      if (best === null || total < best) best = total
    }
  }
  return best
}

export function personalRecords(runs: RunRecord[]): RunRecords {
  const running = runs.filter((r) => r.activity === 'correr')
  return {
    best1k: bestWindow(running, 1),
    best5k: bestWindow(running, 5),
    best10k: bestWindow(running, 10),
    longest: running.length ? Math.max(...running.map((r) => r.distance_m)) : null,
  }
}

// Récords que esta carrera supera respecto a las anteriores
export function newRecords(run: RunRecord, previous: RunRecord[]) {
  if (run.activity !== 'correr') return []
  const before = personalRecords(previous)
  const now = personalRecords([run])
  const list: string[] = []
  const beat = (a: number | null, b: number | null) => a !== null && (b === null || a < b)
  if (beat(now.best1k, before.best1k)) list.push('Mejor kilómetro')
  if (beat(now.best5k, before.best5k)) list.push('Mejor 5K')
  if (beat(now.best10k, before.best10k)) list.push('Mejor 10K')
  if (now.longest !== null && now.longest >= 1000 && (before.longest === null || now.longest > before.longest)) list.push('Carrera más larga')
  return list
}

export function rankRun(run: RunRecord, previous: RunRecord[], records: string[]): { score: number; tier: RankTier; reasons: string[] } {
  const same = previous.filter((r) => r.activity === run.activity && r.avg_pace_seconds && r.distance_m >= 500)
  let score = 50
  const reasons = ['Completaste tu ' + (run.activity === 'correr' ? 'carrera' : 'caminata')]

  if (same.length && run.avg_pace_seconds) {
    const avgPace = same.reduce((s, r) => s + (r.avg_pace_seconds || 0), 0) / same.length
    const change = (avgPace - run.avg_pace_seconds) / avgPace
    if (change >= 0.03) {
      score += 20
      reasons.push(`Ritmo ${Math.round(change * 100)}% más rápido que tu promedio`)
    } else if (change >= -0.02) {
      score += 12
      reasons.push('Mantuviste tu ritmo de siempre')
    } else {
      score += 5
      reasons.push('Ritmo más suave que tu promedio: también suma')
    }
    const avgDistance = same.reduce((s, r) => s + r.distance_m, 0) / same.length
    if (run.distance_m >= avgDistance * 1.1) {
      score += 15
      reasons.push('Más distancia que tu promedio')
    } else if (run.distance_m >= avgDistance * 0.9) {
      score += 10
      reasons.push('Distancia en tu nivel habitual')
    } else {
      score += 5
    }
  } else {
    score += 18
    reasons.push('Primera vez: ya tienes tu punto de partida')
  }

  if (records.length) {
    score += Math.min(15, records.length * 5)
    reasons.push(records.length === 1 ? 'Nuevo récord personal' : `${records.length} récords personales`)
  }

  score = Math.min(100, score)
  const tier: RankTier = score >= 90 ? 'Diamante' : score >= 80 ? 'Platino' : score >= 70 ? 'Oro' : score >= 60 ? 'Plata' : 'Bronce'
  return { score, tier, reasons }
}

// Kilómetros por semana (lunes a domingo, hora local), de la más antigua a la actual
export function weeklyKm(runs: RunRecord[], weeks = 8) {
  const startOfWeek = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.getTime()
  }
  const current = startOfWeek(new Date())
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: current - (weeks - 1 - i) * 7 * 86400000, km: 0 }))
  for (const r of runs) {
    const ws = startOfWeek(new Date(r.started_at))
    const bucket = buckets.find((b) => Math.abs(b.start - ws) < 3600000 * 2)
    if (bucket) bucket.km += r.distance_m / 1000
  }
  return buckets
}
