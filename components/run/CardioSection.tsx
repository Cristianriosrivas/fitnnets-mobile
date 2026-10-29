import { useCallback, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Zap, Footprints, Trophy, Timer, Route as RouteIcon, Minus, Plus } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { formatDuration } from '../../core/training'
import { LatLng, RunRecord, formatKm, formatPace, loadRouteLocally, loadRuns, personalRecords, weeklyKm } from '../../core/running'
import { DaySteps, dailyStepsSupported, loadStepGoal, loadStepHistory, saveStepGoal, syncDailySteps } from '../../core/steps'
import RouteView from './RouteView'
import PressableScale from '../ui/PressableScale'
import GradientFill from '../ui/GradientFill'
import IconBadge from '../ui/IconBadge'
import CountUp from '../ui/CountUp'
import Skeleton from '../ui/Skeleton'
import { colors, glow, gradients } from '../ui/theme'

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function RecordTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-surface2 rounded-2xl p-3" style={{ width: '48.5%', marginBottom: 8 }}>
      <Text className="text-gray-500 text-[11px]">{label}</Text>
      <Text className="text-white text-lg font-extrabold mt-0.5" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  )
}

// Pestaña Cardio de Progreso: semana, km por semana, récords, pasos y carreras recientes
export default function CardioSection() {
  const router = useRouter()
  const [runs, setRuns] = useState<RunRecord[] | null>(null)
  const [steps, setSteps] = useState<DaySteps[]>([])
  const [goal, setGoal] = useState(8000)
  const [routes, setRoutes] = useState<Record<string, LatLng[]>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      if (dailyStepsSupported) await syncDailySteps(user.id)
      const [list, history, stepGoal] = await Promise.all([loadRuns(user.id), loadStepHistory(user.id, 7), loadStepGoal()])
      setRuns(list)
      setSteps(history)
      setGoal(stepGoal)
      const recent = list.slice(0, 8)
      const loaded = await Promise.all(recent.map(async (r) => [r.id, await loadRouteLocally(r.id)] as const))
      setRoutes(Object.fromEntries(loaded.filter(([, route]) => route && route.length > 1)) as Record<string, LatLng[]>)
    } catch {
      setError('No pudimos cargar tu cardio. Revisa tu conexión.')
      setRuns([])
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const changeGoal = (delta: number) => {
    const next = Math.max(2000, Math.min(30000, goal + delta))
    setGoal(next)
    saveStepGoal(next)
  }

  if (runs === null) return <Skeleton height={300} radius={24} />

  if (error) {
    return (
      <View className="bg-surface border border-border rounded-3xl p-6 items-center">
        <Text className="text-gray-400 text-center">{error}</Text>
        <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
          <Text className="text-black font-semibold">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  const weeks = weeklyKm(runs)
  const thisWeek = weeks[weeks.length - 1]
  const weekStart = thisWeek.start
  const weekRuns = runs.filter((r) => new Date(r.started_at).getTime() >= weekStart)
  const weekSeconds = weekRuns.reduce((s, r) => s + r.duration_seconds, 0)
  const maxWeek = Math.max(...weeks.map((w) => w.km), 1)
  const records = personalRecords(runs)
  const maxSteps = Math.max(goal, ...steps.map((d) => d.steps))
  const avgSteps = steps.length ? Math.round(steps.reduce((s, d) => s + d.steps, 0) / steps.length) : 0

  return (
    <View>
      {/* CTA */}
      <PressableScale onPress={() => router.push('/(main)/correr')} accessibilityLabel="Salir a correr" style={{ marginBottom: 14 }}>
        <View className="rounded-3xl overflow-hidden p-4 flex-row items-center gap-3" style={glow('#f97316', 16, 0.35)}>
          <GradientFill colors={['#f97316', '#be123c']} radius={24} direction="horizontal" />
          <Zap color="#ffffff" size={22} fill="#ffffff" />
          <View className="flex-1">
            <Text className="text-white font-extrabold text-base">Salir a correr</Text>
            <Text className="text-white/80 text-xs">GPS, ritmo, pasos y récords</Text>
          </View>
        </View>
      </PressableScale>

      {/* Semana */}
      <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
        <Text className="text-white font-bold text-base mb-3">Esta semana</Text>
        <View className="flex-row justify-between mb-5">
          <View>
            <View className="flex-row items-end">
              <CountUp value={thisWeek.km} decimals={1} className="text-white text-3xl font-extrabold" />
              <Text className="text-gray-400 text-xs mb-1.5 ml-1">km</Text>
            </View>
            <Text className="text-gray-500 text-[11px]">distancia</Text>
          </View>
          <View>
            <Text className="text-white text-3xl font-extrabold">{weekRuns.length}</Text>
            <Text className="text-gray-500 text-[11px]">{weekRuns.length === 1 ? 'salida' : 'salidas'}</Text>
          </View>
          <View>
            <Text className="text-white text-3xl font-extrabold">{formatDuration(weekSeconds)}</Text>
            <Text className="text-gray-500 text-[11px]">tiempo</Text>
          </View>
        </View>
        {/* Km por semana */}
        <View className="flex-row items-end justify-between" style={{ height: 90 }}>
          {weeks.map((w, i) => {
            const current = i === weeks.length - 1
            return (
              <View key={w.start} className="items-center flex-1">
                <View style={{ height: 70, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 5 }}>
                  <View style={{ height: Math.max(4, (w.km / maxWeek) * 70), borderRadius: 6, overflow: 'hidden', backgroundColor: w.km ? undefined : '#1f2926' }}>
                    {w.km ? <GradientFill colors={current ? ['#fdba74', '#f97316'] : ['#22c55e', '#15803d']} direction="vertical" /> : null}
                  </View>
                </View>
                <Text style={{ fontSize: 9, color: current ? colors.orange : colors.muted, marginTop: 4, fontWeight: current ? '800' : '500' }}>
                  {new Date(w.start).toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' })}
                </Text>
              </View>
            )
          })}
        </View>
        <Text className="text-gray-500 text-[11px] mt-2">Km por semana (lunes a domingo)</Text>
      </View>

      {/* Récords */}
      <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Trophy color={colors.gold} size={18} />
          <Text className="text-white font-bold text-base">Tus récords corriendo</Text>
        </View>
        <View className="flex-row flex-wrap justify-between">
          <RecordTile label="Mejor kilómetro" value={records.best1k ? formatPace(records.best1k) : '—'} />
          <RecordTile label="Mejor 5K" value={records.best5k ? formatDuration(records.best5k) : '—'} />
          <RecordTile label="Mejor 10K" value={records.best10k ? formatDuration(records.best10k) : '—'} />
          <RecordTile label="Más larga" value={records.longest ? formatKm(records.longest, 1) + ' km' : '—'} />
        </View>
      </View>

      {/* Pasos */}
      {dailyStepsSupported || steps.length ? (
        <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Footprints color={colors.sky} size={18} />
              <Text className="text-white font-bold text-base">Pasos</Text>
            </View>
            <Text className="text-gray-400 text-xs">{'Promedio ' + avgSteps.toLocaleString('es-CO')}</Text>
          </View>
          {steps.length ? (
            <View className="flex-row items-end justify-between" style={{ height: 90 }}>
              {steps.map((d) => {
                const reached = d.steps >= goal
                return (
                  <View key={d.date} className="items-center flex-1">
                    <View style={{ height: 70, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 6 }}>
                      <View style={{ height: Math.max(4, (d.steps / maxSteps) * 70), borderRadius: 6, overflow: 'hidden' }}>
                        <GradientFill colors={reached ? gradients.brand : gradients.ocean} direction="vertical" />
                      </View>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{DAY_LETTERS[new Date(d.date + 'T12:00:00').getDay()]}</Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text className="text-gray-500 text-sm">Aún no hay pasos registrados. Abre Finnets a diario y aquí verás tu semana.</Text>
          )}
          <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-border">
            <Text className="text-gray-400 text-xs">Meta diaria</Text>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => changeGoal(-1000)} accessibilityLabel="Bajar la meta de pasos" hitSlop={10} className="w-8 h-8 rounded-full bg-surface2 items-center justify-center">
                <Minus color={colors.soft} size={14} />
              </Pressable>
              <Text className="text-white font-bold">{goal.toLocaleString('es-CO')}</Text>
              <Pressable onPress={() => changeGoal(1000)} accessibilityLabel="Subir la meta de pasos" hitSlop={10} className="w-8 h-8 rounded-full bg-surface2 items-center justify-center">
                <Plus color={colors.soft} size={14} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Recientes */}
      <View className="bg-surface border border-border rounded-3xl p-5">
        <Text className="text-white font-bold text-base mb-3">Últimas salidas</Text>
        {runs.length === 0 ? (
          <View className="items-center py-4">
            <IconBadge colors={gradients.ember} size={52} radius={16}>
              <RouteIcon color="#ffffff" size={24} />
            </IconBadge>
            <Text className="text-gray-400 text-sm text-center mt-3">Tu primera carrera aparecerá aquí.</Text>
          </View>
        ) : (
          runs.slice(0, 8).map((r, i) => (
            <View key={r.id} className={`flex-row items-center gap-3 py-2.5 ${i < Math.min(runs.length, 8) - 1 ? 'border-b border-border' : ''}`}>
              <View className="rounded-xl overflow-hidden bg-surface2" style={{ width: 64, height: 48 }}>
                {routes[r.id] ? (
                  <RouteView route={routes[r.id]} width={64} height={48} />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    {r.activity === 'correr' ? <Zap color={colors.muted} size={18} /> : <Footprints color={colors.muted} size={18} />}
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-bold">{formatKm(r.distance_m) + ' km · ' + (r.activity === 'correr' ? 'Carrera' : 'Caminata')}</Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  {new Date(r.started_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + formatPace(r.avg_pace_seconds) + ' /km'}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Timer color={colors.muted} size={12} />
                <Text className="text-gray-400 text-xs" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(r.duration_seconds)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  )
}
