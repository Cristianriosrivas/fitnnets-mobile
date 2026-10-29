import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Animated, Easing, Alert, Linking, useWindowDimensions } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { Pedometer } from 'expo-sensors'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { ArrowLeft, Zap, Footprints, Pause, Play, Timer, Gauge, Flame, Trophy, Check, MapPin, Activity as ActivityIcon } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { checkNewBadges } from '../../core/appChecks'
import { formatDuration } from '../../core/training'
import {
  Activity, GeoPoint, LatLng, RunRecord, RunRecords, acceptPoint, currentPace, formatKm, formatPace, gpsQuality,
  loadRuns, newRecords, personalRecords, rankRun, runCalories, saveRouteLocally, saveRun, simplifyRoute,
} from '../../core/running'
import RouteView from '../../components/run/RouteView'
import FadeIn from '../../components/ui/FadeIn'
import PressableScale from '../../components/ui/PressableScale'
import GradientButton from '../../components/ui/GradientButton'
import GradientFill from '../../components/ui/GradientFill'
import IconBadge from '../../components/ui/IconBadge'
import TiltCard from '../../components/ui/TiltCard'
import CountUp from '../../components/ui/CountUp'
import Confetti from '../../components/ui/Confetti'
import { GlowOrb } from '../../components/ui/Aurora'
import { TIER_STYLE } from '../../components/ui/tierStyle'
import { colors, glow, gradients } from '../../components/ui/theme'

type Phase = 'setup' | 'countdown' | 'running' | 'summary'

const GOALS = [
  { label: 'Libre', meters: 0 },
  { label: '3 km', meters: 3000 },
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
]
const KEEP_AWAKE_TAG = 'finnets-carrera'

type RunResult = {
  run: RunRecord
  route: LatLng[]
  records: string[]
  rank: ReturnType<typeof rankRun>
  saved: boolean
}

function LiveStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <View className="bg-surface border border-border rounded-3xl p-3.5" style={{ width: '48.5%', marginBottom: 10 }}>
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-gray-400 text-xs">{label}</Text>
      </View>
      <Text className="text-white text-2xl font-extrabold mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {sub ? <Text className="text-gray-500 text-[11px]">{sub}</Text> : null}
    </View>
  )
}

// Botón que hay que mantener presionado 1 s: evita terminar la carrera por accidente
function HoldToFinish({ onComplete }: { onComplete: () => void }) {
  const fill = useRef(new Animated.Value(0)).current
  const start = () =>
    Animated.timing(fill, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onComplete()
    })
  const cancel = () => Animated.timing(fill, { toValue: 0, duration: 200, useNativeDriver: true }).start()
  return (
    <View className="items-center">
      <Pressable onPressIn={start} onPressOut={cancel} accessibilityLabel="Mantén presionado para terminar">
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: '#ef4444', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: '#ef4444', transformOrigin: 'bottom', transform: [{ scaleY: fill }] }}
          />
          <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: '#ffffff' }} />
        </View>
      </Pressable>
      <Text className="text-gray-400 text-xs mt-2">Mantén para terminar</Text>
    </View>
  )
}

function SplitBars({ splits }: { splits: number[] }) {
  if (splits.length === 0) return null
  const fastest = Math.min(...splits)
  return (
    <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
      <Text className="text-white font-bold text-base mb-3">Parciales por kilómetro</Text>
      {splits.map((s, i) => {
        const best = s === fastest
        return (
          <View key={i} className="flex-row items-center gap-3 mb-2">
            <Text className="text-gray-400 text-xs w-10">{'Km ' + (i + 1)}</Text>
            <View className="flex-1 h-3 rounded-full bg-surface2 overflow-hidden">
              <View style={{ width: `${Math.max(12, (fastest / s) * 100)}%`, height: '100%', borderRadius: 999, overflow: 'hidden' }}>
                <GradientFill colors={best ? gradients.gold : gradients.brand} direction="horizontal" />
              </View>
            </View>
            <Text className={`text-xs w-12 text-right ${best ? 'text-yellow-400 font-extrabold' : 'text-white font-semibold'}`} style={{ fontVariant: ['tabular-nums'] }}>
              {formatPace(s)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default function CorrerScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [phase, setPhase] = useState<Phase>('setup')
  const [activity, setActivity] = useState<Activity>('correr')
  const [goal, setGoal] = useState(0)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [count, setCount] = useState(3)
  const [records, setRecords] = useState<RunRecords | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)

  // En vivo (lo que se pinta) y referencias (lo que usa el GPS sin esperar a React)
  const [paused, setPaused] = useState(false)
  const [distance, setDistance] = useState(0)
  const [route, setRoute] = useState<LatLng[]>([])
  const [steps, setSteps] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [banner, setBanner] = useState<string | null>(null)
  const phaseRef = useRef<Phase>('setup')
  const pausedRef = useRef(false)
  const activityRef = useRef<Activity>('correr')
  const goalRef = useRef(0)
  const goalReached = useRef(false)
  const points = useRef<GeoPoint[]>([])
  const lastPoint = useRef<GeoPoint | null>(null)
  const distanceRef = useRef(0)
  const track = useRef<{ t: number; d: number }[]>([])
  const kmMarks = useRef<number[]>([]) // segundos transcurridos al completar cada km
  const startAt = useRef(0)
  const pausedMs = useRef(0)
  const pauseStartedAt = useRef(0)
  const rawSteps = useRef(0)
  const stepsAtPause = useRef(0)
  const pausedSteps = useRef(0)
  const locationSub = useRef<Location.LocationSubscription | null>(null)
  const stepSub = useRef<{ remove: () => void } | null>(null)
  const bannerAnim = useRef(new Animated.Value(0)).current
  const countAnim = useRef(new Animated.Value(0)).current

  const [result, setResult] = useState<RunResult | null>(null)
  const [saving, setSaving] = useState(false)

  const elapsedSeconds = useCallback(() => {
    const end = pausedRef.current ? pauseStartedAt.current : Date.now()
    return Math.max(0, (end - startAt.current - pausedMs.current) / 1000)
  }, [])

  const showBanner = useCallback(
    (text: string) => {
      setBanner(text)
      bannerAnim.setValue(0)
      Animated.sequence([
        Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.delay(3200),
        Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()
    },
    [bannerAnim]
  )

  const onLocation = useCallback(
    (loc: Location.LocationObject) => {
      const acc = loc.coords.accuracy ?? null
      setAccuracy(acc)
      if (phaseRef.current !== 'running' || pausedRef.current) return
      const point: GeoPoint = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp }
      const { accept, meters } = acceptPoint(lastPoint.current, point, acc, activityRef.current)
      if (!accept) return
      lastPoint.current = point
      points.current.push(point)
      distanceRef.current += meters
      track.current.push({ t: point.t, d: distanceRef.current })
      if (track.current.length > 200) track.current.splice(0, track.current.length - 200)

      // Cada kilómetro completo: parcial y aviso
      while (kmMarks.current.length < Math.floor(distanceRef.current / 1000)) {
        const elapsed = elapsedSeconds()
        const previous = kmMarks.current[kmMarks.current.length - 1] || 0
        kmMarks.current.push(elapsed)
        showBanner(`Km ${kmMarks.current.length} · ${formatPace(elapsed - previous)} /km`)
      }
      if (goalRef.current && !goalReached.current && distanceRef.current >= goalRef.current) {
        goalReached.current = true
        showBanner('¡Objetivo cumplido! 🎉')
      }

      setDistance(distanceRef.current)
      if (points.current.length % 3 === 0 || points.current.length < 4) setRoute(simplifyRoute(points.current, 300))
    },
    [elapsedSeconds, showBanner]
  )

  // Permiso y GPS desde que se abre la pantalla: así se ve la calidad de la señal antes de salir
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return
      if (status !== 'granted') {
        setPermission('denied')
        return
      }
      setPermission('granted')
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        onLocation
      )
    }
    init()

    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, runs] = await Promise.all([
        supabase.from('profiles').select('weight_kg').eq('id', user.id).single(),
        loadRuns(user.id).catch(() => []),
      ])
      setWeightKg(p?.weight_kg ? Number(p.weight_kg) : null)
      setRecords(personalRecords(runs))
    }
    loadContext()

    return () => {
      cancelled = true
      locationSub.current?.remove()
      stepSub.current?.remove()
      deactivateKeepAwake(KEEP_AWAKE_TAG)
    }
  }, [onLocation])

  // Reloj en vivo
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const beginRun = async () => {
    points.current = []
    lastPoint.current = null
    distanceRef.current = 0
    track.current = []
    kmMarks.current = []
    goalReached.current = false
    pausedMs.current = 0
    pausedRef.current = false
    pausedSteps.current = 0
    rawSteps.current = 0
    activityRef.current = activity
    goalRef.current = goal
    setDistance(0)
    setRoute([])
    setSteps(0)
    setPaused(false)
    startAt.current = Date.now()
    setNow(Date.now())
    phaseRef.current = 'running'
    setPhase('running')
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined)

    try {
      if (await Pedometer.isAvailableAsync()) {
        const perm = await Pedometer.requestPermissionsAsync()
        if (perm.granted) {
          stepSub.current = Pedometer.watchStepCount(({ steps: s }) => {
            rawSteps.current = s
            if (!pausedRef.current) setSteps(s - pausedSteps.current)
          })
        }
      }
    } catch {
      // Sin podómetro: la carrera sigue sin pasos
    }
  }

  const startCountdown = () => {
    setPhase('countdown')
    phaseRef.current = 'countdown'
    let n = 3
    setCount(n)
    const tick = () => {
      countAnim.setValue(0)
      Animated.timing(countAnim, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start()
    }
    tick()
    const timer = setInterval(() => {
      n -= 1
      if (n === 0) {
        clearInterval(timer)
        beginRun()
      } else {
        setCount(n)
        tick()
      }
    }, 1000)
  }

  const togglePause = () => {
    if (pausedRef.current) {
      pausedMs.current += Date.now() - pauseStartedAt.current
      pausedSteps.current += rawSteps.current - stepsAtPause.current
      lastPoint.current = null // al reanudar no se suma la distancia recorrida en pausa
      pausedRef.current = false
      setPaused(false)
    } else {
      pauseStartedAt.current = Date.now()
      stepsAtPause.current = rawSteps.current
      pausedRef.current = true
      setPaused(true)
    }
    setNow(Date.now())
  }

  const save = async (base: RunResult) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    const { id: _tmp, ...payload } = base.run
    const id = await saveRun(user.id, payload)
    if (id) {
      await saveRouteLocally(id, base.route)
      setResult({ ...base, run: { ...base.run, id }, saved: true })
      checkNewBadges()
    } else {
      setResult({ ...base, saved: false })
    }
    setSaving(false)
  }

  const finish = async () => {
    if (!pausedRef.current) {
      pauseStartedAt.current = Date.now()
      pausedRef.current = true
    }
    const duration = Math.round(elapsedSeconds())
    phaseRef.current = 'summary'
    stepSub.current?.remove()
    deactivateKeepAwake(KEEP_AWAKE_TAG)

    const meters = distanceRef.current
    const splits = kmMarks.current.map((mark, i) => Math.round(mark - (kmMarks.current[i - 1] || 0)))
    const run: RunRecord = {
      id: 'nueva',
      activity: activityRef.current,
      started_at: new Date(startAt.current).toISOString(),
      duration_seconds: duration,
      distance_m: Math.round(meters * 10) / 10,
      avg_pace_seconds: meters >= 100 ? Math.round(duration / (meters / 1000)) : null,
      best_km_seconds: splits.length ? Math.min(...splits) : null,
      splits_seconds: splits,
      steps: steps || null,
      calories: runCalories(weightKg, meters, activityRef.current),
    }

    const { data: { user } } = await supabase.auth.getUser()
    const previous = user ? await loadRuns(user.id).catch(() => []) : []
    const recs = newRecords(run, previous)
    const base: RunResult = { run, route: simplifyRoute(points.current), records: recs, rank: rankRun(run, previous, recs), saved: false }
    setResult(base)
    setPhase('summary')

    if (meters < 100) {
      Alert.alert('Recorrido muy corto', 'Registramos menos de 100 m. ¿La guardamos igual?', [
        { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
        { text: 'Guardar', onPress: () => save(base) },
      ])
      return
    }
    save(base)
  }

  const elapsed = phase === 'running' ? (paused ? (pauseStartedAt.current - startAt.current - pausedMs.current) / 1000 : (now - startAt.current - pausedMs.current) / 1000) : 0
  const avgPace = distance >= 50 ? elapsed / (distance / 1000) : null
  const livePace = currentPace(track.current)
  const cadence = elapsed > 30 && steps ? Math.round(steps / (elapsed / 60)) : null
  const quality = gpsQuality(accuracy)

  // ----- Resumen -----
  if (phase === 'summary' && result) {
    const tier = TIER_STYLE[result.rank.tier]
    const TierIcon = tier.icon
    const { run } = result
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ gestureEnabled: true }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <GlowOrb color={colors.primary} size={380} style={{ top: -140, alignSelf: 'center' }} intensity={0.28} />
          <FadeIn style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              {run.activity === 'correr' ? 'Carrera completada' : 'Caminata completada'}
            </Text>
            <View className="flex-row items-end mt-1">
              <CountUp value={run.distance_m / 1000} decimals={2} style={{ color: '#ffffff', fontSize: 56, fontWeight: '900' }} />
              <Text className="text-gray-400 text-lg font-bold mb-2.5 ml-1.5">km</Text>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <View className="bg-surface border border-border rounded-3xl overflow-hidden mb-4 items-center">
              <RouteView route={result.route} width={width - 34} height={220} />
            </View>
          </FadeIn>

          <FadeIn delay={140}>
            <View className="flex-row flex-wrap justify-between">
              <LiveStat icon={<Timer color={colors.primary} size={14} />} label="Tiempo" value={formatDuration(run.duration_seconds)} />
              <LiveStat icon={<Gauge color={colors.primary} size={14} />} label="Ritmo medio" value={formatPace(run.avg_pace_seconds)} sub="min/km" />
              <LiveStat icon={<Zap color={colors.gold} size={14} />} label="Mejor km" value={formatPace(run.best_km_seconds)} sub="min/km" />
              <LiveStat icon={<Flame color={colors.orange} size={14} />} label="Calorías" value={String(run.calories ?? 0)} sub="kcal aprox." />
              {run.steps ? (
                <>
                  <LiveStat icon={<Footprints color={colors.sky} size={14} />} label="Pasos" value={run.steps.toLocaleString('es-CO')} />
                  <LiveStat
                    icon={<ActivityIcon color={colors.sky} size={14} />}
                    label="Cadencia"
                    value={run.duration_seconds ? String(Math.round(run.steps / (run.duration_seconds / 60))) : '--'}
                    sub="pasos por minuto"
                  />
                </>
              ) : null}
            </View>
          </FadeIn>

          {/* Rango */}
          <FadeIn delay={200}>
            <TiltCard float glare radius={28} maxTilt={8} style={[{ marginBottom: 16, marginTop: 6 }, glow(tier.colors[1], 26, 0.4)]}>
              <View style={{ borderRadius: 28, overflow: 'hidden', padding: 20 }} className="flex-row items-center gap-4">
                <GradientFill colors={tier.colors} radius={28} />
                <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                  <TierIcon color={tier.text} size={32} />
                </View>
                <View className="flex-1">
                  <Text style={{ color: tier.text, opacity: 0.75, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>RANGO</Text>
                  <Text style={{ color: tier.text, fontSize: 28, fontWeight: '900' }}>{result.rank.tier}</Text>
                  <Text style={{ color: tier.text, opacity: 0.8, fontSize: 13, fontWeight: '700' }}>{result.rank.score + '/100'}</Text>
                </View>
              </View>
            </TiltCard>
          </FadeIn>

          <FadeIn delay={240}>
            <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
              {result.records.length ? (
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {result.records.map((r) => (
                    <View key={r} className="flex-row items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full px-3 py-1.5">
                      <Trophy color={colors.gold} size={13} />
                      <Text className="text-yellow-300 text-xs font-extrabold">{r}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {result.rank.reasons.map((reason) => (
                <View key={reason} className="flex-row items-center gap-2.5 mb-2">
                  <View className="w-5 h-5 rounded-full bg-green-500/20 items-center justify-center">
                    <Check color={colors.primary} size={12} strokeWidth={3} />
                  </View>
                  <Text className="text-gray-300 text-sm flex-1">{reason}</Text>
                </View>
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={280}>
            <SplitBars splits={run.splits_seconds || []} />
          </FadeIn>

          {!result.saved ? (
            <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 mb-4">
              <Text className="text-red-400 text-sm">
                {saving ? 'Guardando tu carrera…' : 'No se pudo guardar la carrera. Revisa tu conexión.'}
              </Text>
              {!saving ? (
                <Pressable onPress={() => save(result)} className="mt-2 self-start">
                  <Text className="text-primary text-sm font-semibold">Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text className="text-gray-500 text-xs text-center mb-4">Tu ruta se guardó solo en este teléfono.</Text>
          )}

          <GradientButton title="Listo" onPress={() => router.back()} disabled={saving} icon={<Check color="#04120a" size={18} strokeWidth={3} />} />
        </ScrollView>
        {result.records.length ? <Confetti /> : null}
      </View>
    )
  }

  // ----- Cuenta regresiva -----
  if (phase === 'countdown') {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ gestureEnabled: false }} />
        <GlowOrb color={colors.primary} size={420} intensity={0.35} drift={6} duration={1200} />
        <Text className="text-gray-400 text-sm font-bold uppercase mb-4" style={{ letterSpacing: 3 }}>
          {activity === 'correr' ? 'Prepárate para correr' : 'Prepárate para caminar'}
        </Text>
        <Animated.Text
          style={{
            color: '#ffffff',
            fontSize: 160,
            fontWeight: '900',
            opacity: countAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: countAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          {count}
        </Animated.Text>
      </View>
    )
  }

  // ----- En vivo -----
  if (phase === 'running') {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ gestureEnabled: false }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 58, paddingBottom: 30 }} scrollEnabled>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
              {activity === 'correr' ? <Zap color={colors.primary} size={13} /> : <Footprints color={colors.primary} size={13} />}
              <Text className="text-white text-xs font-bold">{activity === 'correr' ? 'Corriendo' : 'Caminando'}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: quality.color }} />
              <Text className="text-gray-400 text-[11px]">GPS</Text>
            </View>
          </View>

          <View className="items-center mt-2 mb-3">
            <View className="flex-row items-end">
              <Text style={{ color: paused ? colors.muted : '#ffffff', fontSize: 84, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 92 }}>
                {formatKm(distance)}
              </Text>
              <Text className="text-gray-400 text-xl font-bold mb-3 ml-1.5">km</Text>
            </View>
            {paused ? <Text className="text-yellow-400 text-xs font-extrabold" style={{ letterSpacing: 3 }}>EN PAUSA</Text> : null}
            {goal ? (
              <View className="w-full mt-3">
                <View className="h-2 rounded-full bg-surface2 overflow-hidden">
                  <View style={{ width: `${Math.min(100, (distance / goal) * 100)}%`, height: '100%', borderRadius: 999, overflow: 'hidden' }}>
                    <GradientFill colors={gradients.brand} direction="horizontal" />
                  </View>
                </View>
                <Text className="text-gray-500 text-[11px] mt-1 text-right">{'Objetivo ' + formatKm(goal, 0) + ' km'}</Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row flex-wrap justify-between">
            <LiveStat icon={<Timer color={colors.primary} size={14} />} label="Tiempo" value={formatDuration(elapsed)} />
            <LiveStat icon={<Gauge color={colors.primary} size={14} />} label="Ritmo actual" value={formatPace(paused ? null : livePace)} sub="min/km" />
            <LiveStat icon={<Gauge color={colors.soft} size={14} />} label="Ritmo medio" value={formatPace(avgPace)} sub="min/km" />
            <LiveStat icon={<Footprints color={colors.sky} size={14} />} label="Pasos" value={steps.toLocaleString('es-CO')} sub={cadence ? cadence + ' pasos/min' : undefined} />
          </View>

          <View className="bg-surface border border-border rounded-3xl overflow-hidden mt-1 items-center">
            <RouteView route={route} width={width - 34} height={170} live />
          </View>

          <View className="flex-row items-center justify-center gap-10 mt-7">
            {paused ? (
              <>
                <HoldToFinish onComplete={finish} />
                <View className="items-center">
                  <PressableScale onPress={togglePause} accessibilityLabel="Reanudar">
                    <View className="w-[84px] h-[84px] rounded-full items-center justify-center overflow-hidden" style={glow(colors.primary, 18, 0.5)}>
                      <GradientFill colors={gradients.brand} radius={42} />
                      <Play color="#04120a" size={30} fill="#04120a" />
                    </View>
                  </PressableScale>
                  <Text className="text-gray-400 text-xs mt-2">Reanudar</Text>
                </View>
              </>
            ) : (
              <View className="items-center">
                <PressableScale onPress={togglePause} accessibilityLabel="Pausar">
                  <View className="w-[92px] h-[92px] rounded-full bg-surface2 border-2 border-yellow-400 items-center justify-center">
                    <Pause color={colors.gold} size={34} fill={colors.gold} />
                  </View>
                </PressableScale>
                <Text className="text-gray-400 text-xs mt-2">Pausar</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 text-[11px] text-center mt-6 leading-4">
            Mantén la app abierta: la pantalla no se apagará. Si la bloqueas, ese tramo se estima en línea recta.
          </Text>
        </ScrollView>

        {/* Aviso de cada kilómetro */}
        {banner ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 54,
              left: 16,
              right: 16,
              opacity: bannerAnim,
              transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            }}
          >
            <View className="rounded-2xl overflow-hidden px-4 py-3.5 flex-row items-center gap-3" style={glow(colors.primary, 16, 0.5)}>
              <GradientFill colors={gradients.brand} direction="horizontal" />
              <MapPin color="#04120a" size={18} />
              <Text style={{ color: '#04120a', fontWeight: '900', fontSize: 16 }}>{banner}</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    )
  }

  // ----- Preparación -----
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <GlowOrb color={colors.orange} size={360} style={{ top: -170, right: -140 }} intensity={0.24} />
      <FadeIn>
        <View className="flex-row items-end gap-3 mb-6">
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-1.5">
            <ArrowLeft color={colors.soft} size={22} />
          </Pressable>
          <View>
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              Cardio
            </Text>
            <Text className="text-white text-3xl font-extrabold mt-1">Salir a correr</Text>
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={60}>
        <View className="flex-row gap-3 mb-5">
          {(['correr', 'caminar'] as Activity[]).map((a) => {
            const active = activity === a
            return (
              <PressableScale key={a} onPress={() => setActivity(a)} style={{ flex: 1 }} accessibilityLabel={a === 'correr' ? 'Correr' : 'Caminar'}>
                <View
                  className="rounded-3xl p-4 items-center"
                  style={{ backgroundColor: active ? 'rgba(34,197,94,0.12)' : colors.surface, borderWidth: 1.5, borderColor: active ? colors.primary : colors.border }}
                >
                  <IconBadge colors={a === 'correr' ? gradients.ember : gradients.ocean} size={48} radius={16} shine={active}>
                    {a === 'correr' ? <Zap color="#ffffff" size={22} /> : <Footprints color="#04120a" size={22} />}
                  </IconBadge>
                  <Text className="text-white font-bold mt-2">{a === 'correr' ? 'Correr' : 'Caminar'}</Text>
                </View>
              </PressableScale>
            )
          })}
        </View>
      </FadeIn>

      <FadeIn delay={110}>
        <Text className="text-gray-400 text-xs font-semibold mb-2 ml-1">Objetivo</Text>
        <View className="flex-row gap-2 mb-5">
          {GOALS.map((g) => {
            const active = goal === g.meters
            return (
              <Pressable
                key={g.label}
                onPress={() => setGoal(g.meters)}
                className={`flex-1 py-3 rounded-2xl items-center border ${active ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={active ? 'text-black font-extrabold' : 'text-gray-300 font-semibold'}>{g.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </FadeIn>

      <FadeIn delay={160}>
        <View className="bg-surface border border-border rounded-3xl p-4 mb-4">
          {permission === 'denied' ? (
            <>
              <Text className="text-red-400 text-sm font-semibold">Sin permiso de ubicación</Text>
              <Text className="text-gray-400 text-xs mt-1 leading-4">
                Finnets necesita el GPS para medir la distancia. Actívalo en los ajustes del teléfono.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} className="mt-2 self-start">
                <Text className="text-primary text-sm font-semibold">Abrir ajustes</Text>
              </Pressable>
            </>
          ) : (
            <View className="flex-row items-center gap-2.5">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: quality.color }} />
              <Text className="text-white text-sm flex-1">{quality.label}</Text>
            </View>
          )}
        </View>
      </FadeIn>

      {records && (records.best5k || records.longest) ? (
        <FadeIn delay={200}>
          <View className="flex-row gap-3 mb-6">
            {records.best5k ? (
              <View className="flex-1 bg-surface border border-border rounded-3xl p-4">
                <Text className="text-gray-400 text-xs">Tu mejor 5K</Text>
                <Text className="text-white text-xl font-extrabold mt-0.5">{formatDuration(records.best5k)}</Text>
              </View>
            ) : null}
            {records.longest ? (
              <View className="flex-1 bg-surface border border-border rounded-3xl p-4">
                <Text className="text-gray-400 text-xs">Más larga</Text>
                <Text className="text-white text-xl font-extrabold mt-0.5">{formatKm(records.longest, 1) + ' km'}</Text>
              </View>
            ) : null}
          </View>
        </FadeIn>
      ) : null}

      <FadeIn delay={240} style={{ alignItems: 'center', marginTop: 10 }}>
        <PressableScale onPress={startCountdown} disabled={permission !== 'granted'} accessibilityLabel="Empezar">
          <View style={[{ width: 150, height: 150, borderRadius: 75, padding: 6 }, glow(colors.primary, 30, 0.6)]}>
            <View style={{ flex: 1, borderRadius: 75, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <GradientFill colors={gradients.brand} radius={75} />
              <Play color="#04120a" size={40} fill="#04120a" />
              <Text style={{ color: '#04120a', fontWeight: '900', fontSize: 15, marginTop: 4, letterSpacing: 1 }}>EMPEZAR</Text>
            </View>
          </View>
        </PressableScale>
        <Text className="text-gray-500 text-xs text-center mt-5 leading-4 px-6">
          La ruta se guarda solo en tu teléfono. Durante la carrera la pantalla se mantiene encendida.
        </Text>
      </FadeIn>
    </ScrollView>
  )
}
