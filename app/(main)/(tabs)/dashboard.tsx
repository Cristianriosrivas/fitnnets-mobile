import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, RefreshControl, Animated } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import { Weight, Ruler, Dumbbell, Flame, Play, Droplet, Trophy, ChevronRight, Plus, PersonStanding, BatteryCharging, Sparkles, Zap, Footprints } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import Aurora from '../../../components/ui/Aurora'
import FadeIn from '../../../components/ui/FadeIn'
import TiltCard from '../../../components/ui/TiltCard'
import PressableScale from '../../../components/ui/PressableScale'
import GradientFill from '../../../components/ui/GradientFill'
import IconBadge from '../../../components/ui/IconBadge'
import AnimatedRing from '../../../components/ui/AnimatedRing'
import CountUp from '../../../components/ui/CountUp'
import Skeleton from '../../../components/ui/Skeleton'
import { colors, glow, gradients, GradientColors } from '../../../components/ui/theme'
import BodyMap, { BodyVariant, preferredVariant } from '../../../components/body/BodyMap'
import { Region } from '../../../core/muscles'
import { RecoveryMap, computeRecovery, loadRecentLogs, readiness, recommendDay, recoveryColor, tiredRegions } from '../../../core/recovery'
import { dailyStepsSupported, loadStepGoal, syncDailySteps } from '../../../core/steps'

const TIPS = [
  'Mantén una buena hidratación. El agua mejora tu rendimiento y recuperación.',
  'La constancia es más importante que la intensidad. Entrena con calidad, no solo con prisa.',
  'Duerme al menos 7 horas: es cuando tu cuerpo realmente construye músculo.',
  'El calentamiento previene lesiones y mejora tu rendimiento en cada serie.',
  'La proteína después de entrenar ayuda a la recuperación muscular.',
  'Progresar poco a poco es mejor que forzar demasiado y lesionarte.',
  'Escucha a tu cuerpo: el descanso también es parte del entrenamiento.',
]

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

type StatProps = {
  icon: React.ReactNode
  colors: GradientColors
  label: string
  children: React.ReactNode
}

function StatCard({ icon, colors: gradient, label, children }: StatProps) {
  return (
    <TiltCard maxTilt={12} style={{ width: '100%' }} radius={22}>
      <View className="bg-surface border border-border rounded-[22px] p-4">
        <IconBadge colors={gradient} size={34} radius={11}>
          {icon}
        </IconBadge>
        <Text className="text-gray-400 text-xs mt-3">{label}</Text>
        <View className="flex-row items-end mt-0.5">{children}</View>
      </View>
    </TiltCard>
  )
}

// Barras de la semana que crecen con rebote, una tras otra
function WeekBars({ days }: { days: { label: string; trained: boolean }[] }) {
  const grow = useRef(days.map(() => new Animated.Value(0))).current

  useEffect(() => {
    Animated.stagger(
      70,
      grow.map((value) => Animated.spring(value, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 9 }))
    ).start()
  }, [grow])

  return (
    <View className="flex-1 flex-row items-end justify-between ml-5" style={{ height: 92 }}>
      {days.map((d, i) => (
        <View key={i} className="items-center flex-1">
          <View style={{ height: 66, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 4 }}>
            <Animated.View
              style={{
                height: d.trained ? 66 : 14,
                borderRadius: 999,
                overflow: 'hidden',
                backgroundColor: d.trained ? undefined : '#1f2926',
                transformOrigin: 'bottom',
                transform: [{ scaleY: grow[i] }],
              }}
            >
              {d.trained ? <GradientFill colors={['#a3e635', '#22c55e', '#15803d']} direction="vertical" /> : null}
            </Animated.View>
          </View>
          <Text style={{ fontSize: 10, color: i === days.length - 1 ? colors.primary : colors.muted, marginTop: 6, fontWeight: i === days.length - 1 ? '700' : '500' }}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

// Cuerpo de frente y espalda pintado por recuperación, con qué músculos conviene descansar
function RecoveryCard({ map, variant, onPress }: { map: RecoveryMap; variant: BodyVariant; onPress: () => void }) {
  const score = readiness(map)
  const tired = tiredRegions(map)
  const values = Object.fromEntries(Object.entries(map).map(([region, r]) => [region, r.recovery])) as Record<Region, number>
  const colorFor = (_region: Region, value: number) => recoveryColor(value)
  const advice = tired.length
    ? 'Descansa ' + tired.slice(0, 2).map((t) => `${t.label.toLowerCase()} (${Math.round(t.recovery * 100)}%, lista en ${t.hoursToFull} h)`).join(' y ')
    : 'Todo tu cuerpo está recuperado. ¡A entrenar!'
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Ver mi recuperación muscular">
      <View className="bg-surface border border-border rounded-3xl p-4 mb-4 flex-row items-center gap-3">
        <View className="flex-row">
          <BodyMap variant={variant} side="front" values={values} width={50} colorFor={colorFor} pulse={false} />
          <BodyMap variant={variant} side="back" values={values} width={50} colorFor={colorFor} pulse={false} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <BatteryCharging color={recoveryColor(score / 100)} size={15} />
            <Text className="text-gray-400 text-xs">Recuperación muscular</Text>
          </View>
          <View className="flex-row items-end mt-0.5">
            <CountUp value={score} suffix="%" className="text-2xl font-extrabold" style={{ color: recoveryColor(score / 100) }} />
            <Text className="text-gray-400 text-xs mb-1 ml-1.5">
              {score >= 85 ? 'listo para todo' : score >= 65 ? 'listo para entrenar' : 'mejor un día suave'}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs mt-1 leading-4" numberOfLines={3}>
            {advice}
          </Text>
        </View>
        <ChevronRight color={colors.muted} size={18} />
      </View>
    </PressableScale>
  )
}

function DashboardSkeleton() {
  return (
    <View className="flex-1 bg-background" style={{ paddingHorizontal: 16, paddingTop: 64 }}>
      <Skeleton height={18} width={120} radius={8} />
      <Skeleton height={34} width={200} radius={10} style={{ marginTop: 10 }} />
      <Skeleton height={190} radius={28} style={{ marginTop: 26 }} />
      <View className="flex-row justify-between mt-4">
        <Skeleton height={118} width="48.5%" radius={22} />
        <Skeleton height={118} width="48.5%" radius={22} />
      </View>
      <Skeleton height={150} radius={24} style={{ marginTop: 14 }} />
    </View>
  )
}

export default function DashboardScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [username, setUsername] = useState('')
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [bicepCm, setBicepCm] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [last7, setLast7] = useState<{ label: string; trained: boolean }[]>([])
  const [latestRoutine, setLatestRoutine] = useState<{
    id: string
    title: string
    dayTitle: string
    exerciseCount: number
    dayId?: string
    readiness?: number
    focus?: string[]
  } | null>(null)
  const [recovery, setRecovery] = useState<RecoveryMap | null>(null)
  const [variant, setVariant] = useState<BodyVariant>('male')
  const [stepsToday, setStepsToday] = useState<number | null>(null)
  const [stepGoal, setStepGoal] = useState(8000)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, weight_kg, height_cm, gender')
      .eq('id', user.id)
      .single()

    setUsername(profile?.username || '')
    setWeightKg(profile?.weight_kg ?? null)
    setHeightCm(profile?.height_cm ?? null)

    // Ultima medida de brazo registrada (ignora registros que solo traen el peso)
    const { data: metric } = await supabase
      .from('body_metrics')
      .select('bicep_cm')
      .eq('user_id', user.id)
      .not('bicep_cm', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBicepCm(metric?.bicep_cm ?? null)

    // Racha de dias consecutivos (un dia con carrera tambien cuenta como entrenado)
    const [{ data: logs }, { data: runDays }] = await Promise.all([
      supabase.from('progress_logs').select('date').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('runs').select('started_at').eq('user_id', user.id).order('started_at', { ascending: false }).limit(400),
    ])

    const uniqueDates = Array.from(
      new Set([...(logs || []).map((l) => l.date as string), ...(runDays || []).map((r) => (r.started_at as string).slice(0, 10))])
    ).sort().reverse()
    let currentStreak = 0
    let checkDate = new Date()
    for (const dateStr of uniqueDates) {
      const logDate = new Date(dateStr)
      const diffDays = Math.floor((checkDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 1) {
        currentStreak++
        checkDate = logDate
      } else break
    }
    setStreak(currentStreak)

    // Ultimos 7 dias: que dias entreno
    const week: { label: string; trained: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      week.push({ label: DAY_LABELS[d.getDay()], trained: uniqueDates.includes(dateStr) })
    }
    setLast7(week)

    // "Tu rutina de hoy": el dia de tus rutinas cuyos musculos estan mas recuperados
    const [{ data: routines }, recentLogs, variantPref] = await Promise.all([
      supabase
        .from('routines')
        .select('id, title, routine_days(id, day_number, title, routine_exercises(id, sets, exercises(name, muscle_group)))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      loadRecentLogs(user.id).catch(() => []),
      preferredVariant(profile?.gender),
    ])
    const recoveryMap = computeRecovery(recentLogs)
    setRecovery(recoveryMap)
    setVariant(variantPref)

    // Pasos del dia: solo el iPhone guarda historial (Android llega con Health Connect en la APK)
    if (dailyStepsSupported) {
      const [days, goal] = await Promise.all([syncDailySteps(user.id), loadStepGoal()])
      setStepsToday(days ? days[days.length - 1].steps : null)
      setStepGoal(goal)
    }

    const recommended = recommendDay(routines || [], recoveryMap)
    if (recommended) {
      setLatestRoutine({
        id: recommended.routineId,
        title: recommended.routineTitle,
        dayId: recommended.dayId,
        dayTitle: recommended.dayTitle,
        exerciseCount: recommended.exerciseCount,
        readiness: recommended.readiness,
        focus: recommended.focus,
      })
    } else if (routines?.[0]) {
      const routine: any = routines[0]
      const firstDay: any = [...(routine.routine_days || [])].sort((a: any, b: any) => a.day_number - b.day_number)[0]
      setLatestRoutine({ id: routine.id, title: routine.title, dayTitle: firstDay?.title || routine.title, exerciseCount: firstDay?.routine_exercises?.length || 0 })
    } else {
      setLatestRoutine(null)
    }

    setLoading(false)
  }, [])

  // Recarga los datos cada vez que la pantalla vuelve a estar en foco
  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const trainedDays = last7.filter((d) => d.trained).length
  const weekPercent = Math.round((trainedDays / 7) * 100)
  const tipOfDay = TIPS[new Date().getDate() % TIPS.length]

  if (loading) return <DashboardSkeleton />

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Aurora height={480} style={{ top: -60, left: -16, right: -16 }} />

      {/* Encabezado: el avatar abre el perfil */}
      <FadeIn>
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-1 pr-3">
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              {greeting()}
            </Text>
            <Text className="text-white text-3xl font-extrabold mt-1" numberOfLines={1}>
              {(username || 'Atleta') + ' 👋'}
            </Text>
            <Text className="text-gray-400 text-sm mt-1">Tu progreso es el resultado de tus hábitos.</Text>
          </View>
          <PressableScale onPress={() => router.push('/(main)/perfil')} accessibilityLabel="Editar perfil">
            <View style={[{ width: 52, height: 52, borderRadius: 26, padding: 2.5 }, glow(colors.primary, 14, 0.5)]}>
              <View style={{ flex: 1, borderRadius: 26, overflow: 'hidden' }}>
                <GradientFill colors={gradients.brand} radius={26} />
                <View className="flex-1 m-[2.5px] rounded-full bg-background items-center justify-center">
                  <Text className="text-primary font-extrabold text-lg">{username?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
              </View>
            </View>
          </PressableScale>
        </View>
      </FadeIn>

      {/* Tu rutina de hoy: tarjeta 3D flotante */}
      <FadeIn delay={90}>
        <TiltCard
          float
          glare
          radius={28}
          maxTilt={7}
          onPress={() =>
            latestRoutine
              ? router.push({ pathname: '/(main)/entrenar/[id]', params: { id: latestRoutine.id, ...(latestRoutine.dayId ? { dayId: latestRoutine.dayId } : {}) } })
              : router.push('/(main)/(tabs)/rutinas')
          }
          accessibilityLabel={latestRoutine ? 'Iniciar ' + latestRoutine.dayTitle : 'Crear rutina'}
          style={[{ marginBottom: 16 }, glow(colors.primary, 26, 0.35)]}
        >
          <View style={{ borderRadius: 28, overflow: 'hidden', padding: 22, minHeight: 190 }}>
            <GradientFill colors={['#16a34a', '#047857', '#022c22']} radius={28} />
            {/* Anillos decorativos */}
            <Svg width={220} height={220} style={{ position: 'absolute', right: -70, top: -50 }} pointerEvents="none">
              <Circle cx={110} cy={110} r={100} stroke="rgba(255,255,255,0.10)" strokeWidth={2} fill="none" />
              <Circle cx={110} cy={110} r={72} stroke="rgba(255,255,255,0.08)" strokeWidth={2} fill="none" />
              <Circle cx={110} cy={110} r={44} stroke="rgba(255,255,255,0.06)" strokeWidth={2} fill="none" />
            </Svg>
            <View style={{ position: 'absolute', right: 18, bottom: 14, opacity: 0.12 }} pointerEvents="none">
              <Dumbbell color="#ffffff" size={96} />
            </View>

            <Text className="text-white/70 text-[11px] font-bold uppercase" style={{ letterSpacing: 2 }}>
              Tu rutina de hoy
            </Text>
            {latestRoutine ? (
              <>
                <Text className="text-white text-2xl font-extrabold mt-2" numberOfLines={2}>
                  {latestRoutine.dayTitle}
                </Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View className="bg-white/15 rounded-full px-2.5 py-1">
                    <Text className="text-white text-xs font-semibold">{latestRoutine.exerciseCount + ' ejercicios'}</Text>
                  </View>
                  <Text className="text-white/70 text-xs flex-1" numberOfLines={1}>
                    {latestRoutine.title}
                  </Text>
                </View>
                {latestRoutine.readiness !== undefined ? (
                  <View className="flex-row items-center gap-1.5 mt-2.5">
                    <BatteryCharging color="#bbf7d0" size={14} />
                    <Text className="text-white/90 text-xs font-semibold" numberOfLines={1}>
                      {'Elegida por tu recuperación: ' + (latestRoutine.focus?.join(' y ') || 'músculos') + ' al ' + latestRoutine.readiness + '%'}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row items-center self-start bg-white rounded-full pl-3 pr-4 py-2.5 mt-5 gap-2">
                  <View className="bg-primary rounded-full p-1">
                    <Play color="#04120a" size={12} fill="#04120a" />
                  </View>
                  <Text className="text-black font-bold text-sm">Iniciar rutina</Text>
                </View>
              </>
            ) : (
              <>
                <Text className="text-white text-2xl font-extrabold mt-2">Aún no tienes una rutina</Text>
                <Text className="text-white/70 text-sm mt-1">Genera una con IA o créala a tu medida.</Text>
                <View className="flex-row items-center self-start bg-white rounded-full pl-3 pr-4 py-2.5 mt-5 gap-2">
                  <Plus color="#04120a" size={16} />
                  <Text className="text-black font-bold text-sm">Crear rutina</Text>
                </View>
              </>
            )}
          </View>
        </TiltCard>
      </FadeIn>

      {/* Recuperacion muscular */}
      {recovery ? (
        <FadeIn delay={140}>
          <RecoveryCard map={recovery} variant={variant} onPress={() => router.push({ pathname: '/(main)/cuerpo', params: { mode: 'recuperacion' } })} />
        </FadeIn>
      ) : null}

      {/* Correr y pasos del dia */}
      <FadeIn delay={160}>
        <View className="flex-row gap-3 mb-4">
          <PressableScale onPress={() => router.push('/(main)/correr')} style={{ flex: 1 }} accessibilityLabel="Salir a correr">
            <View className="rounded-3xl overflow-hidden p-4" style={{ minHeight: 132 }}>
              <GradientFill colors={['#f97316', '#be123c']} radius={24} />
              <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <Zap color="#ffffff" size={20} fill="#ffffff" />
              </View>
              <Text className="text-white font-extrabold text-base mt-3">Salir a correr</Text>
              <Text className="text-white/80 text-xs mt-0.5">Km, ritmo y pasos con GPS</Text>
            </View>
          </PressableScale>
          {stepsToday !== null ? (
            <PressableScale
              onPress={() => router.push({ pathname: '/(main)/(tabs)/progreso', params: { tab: 'Cardio' } })}
              style={{ flex: 1 }}
              accessibilityLabel="Ver mis pasos"
            >
              <View className="bg-surface border border-border rounded-3xl p-4 items-center" style={{ minHeight: 132 }}>
                <AnimatedRing progress={Math.min(100, (stepsToday / stepGoal) * 100)} size={64} stroke={7} colors={gradients.ocean} delay={200}>
                  <Footprints color={colors.sky} size={18} />
                </AnimatedRing>
                <CountUp value={stepsToday} className="text-white text-lg font-extrabold mt-2" />
                <Text className="text-gray-400 text-[11px]">{'de ' + stepGoal.toLocaleString('es-CO') + ' pasos'}</Text>
              </View>
            </PressableScale>
          ) : null}
        </View>
      </FadeIn>

      {/* Estadisticas en tarjetas 3D */}
      <View className="flex-row flex-wrap justify-between">
        <FadeIn delay={170} style={{ width: '48.5%', marginBottom: 12 }}>
          <StatCard icon={<Weight color="#04120a" size={17} />} colors={gradients.brand} label="Peso actual">
            {weightKg ? (
              <>
                <CountUp value={Number(weightKg)} decimals={Number.isInteger(Number(weightKg)) ? 0 : 1} className="text-white text-2xl font-extrabold" />
                <Text className="text-gray-400 text-xs mb-1 ml-1">kg</Text>
              </>
            ) : (
              <Text className="text-white text-2xl font-extrabold">--</Text>
            )}
          </StatCard>
        </FadeIn>
        <FadeIn delay={230} style={{ width: '48.5%', marginBottom: 12 }}>
          <StatCard icon={<Ruler color="#04120a" size={17} />} colors={gradients.ocean} label="Altura">
            {/* La altura debe guardarse en cm (ej: 181). Si algun dato viejo quedo en metros (ej: 1.81), se muestra bien igual. */}
            {heightCm ? (
              <>
                <CountUp value={Number(heightCm)} decimals={heightCm > 3 ? 0 : 2} className="text-white text-2xl font-extrabold" />
                <Text className="text-gray-400 text-xs mb-1 ml-1">{heightCm > 3 ? 'cm' : 'm'}</Text>
              </>
            ) : (
              <Text className="text-white text-2xl font-extrabold">--</Text>
            )}
          </StatCard>
        </FadeIn>
        <FadeIn delay={290} style={{ width: '48.5%', marginBottom: 12 }}>
          <StatCard icon={<Dumbbell color="#ffffff" size={17} />} colors={gradients.violet} label="Brazo">
            {bicepCm ? (
              <>
                <CountUp value={Number(bicepCm)} decimals={Number.isInteger(Number(bicepCm)) ? 0 : 1} className="text-white text-2xl font-extrabold" />
                <Text className="text-gray-400 text-xs mb-1 ml-1">cm</Text>
              </>
            ) : (
              <Text className="text-white text-2xl font-extrabold">--</Text>
            )}
          </StatCard>
        </FadeIn>
        <FadeIn delay={350} style={{ width: '48.5%', marginBottom: 12 }}>
          <StatCard icon={<Flame color="#ffffff" size={17} />} colors={gradients.ember} label="Racha actual">
            <CountUp value={streak} className="text-white text-2xl font-extrabold" />
            <Text className="text-gray-400 text-xs mb-1 ml-1">{streak === 1 ? 'día' : 'días'}</Text>
          </StatCard>
        </FadeIn>
      </View>

      {/* Progreso semanal */}
      <FadeIn delay={420}>
        <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-bold text-base">Progreso semanal</Text>
            <View className="bg-green-500/15 rounded-full px-2.5 py-1">
              <Text className="text-primary text-xs font-bold">{trainedDays + '/7 días'}</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <AnimatedRing progress={weekPercent} size={104} stroke={11} delay={300}>
              <CountUp value={weekPercent} suffix="%" delay={300} className="text-white text-xl font-extrabold" />
              <Text style={{ fontSize: 9, color: colors.soft }}>completado</Text>
            </AnimatedRing>
            <WeekBars days={last7} />
          </View>
        </View>
      </FadeIn>

      {/* Finnets Wrapped */}
      <FadeIn delay={460}>
        <TiltCard glare radius={24} maxTilt={8} onPress={() => router.push('/(main)/wrapped')} accessibilityLabel="Ver mi resumen del mes" style={{ marginBottom: 16 }}>
          <View style={{ borderRadius: 24, overflow: 'hidden', padding: 18 }} className="flex-row items-center gap-3">
            <GradientFill colors={['#7e22ce', '#c2410c', '#ca8a04']} radius={24} />
            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Sparkles color="#ffffff" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-white/80 text-[11px] font-bold uppercase" style={{ letterSpacing: 2 }}>
                Finnets Wrapped
              </Text>
              <Text className="text-white font-extrabold text-lg">Tu mes en Finnets</Text>
              <Text className="text-white/80 text-xs">Tus números del mes, listos para compartir</Text>
            </View>
            <ChevronRight color="#ffffff" size={20} />
          </View>
        </TiltCard>
      </FadeIn>

      {/* Logros */}
      <FadeIn delay={490}>
        <PressableScale onPress={() => router.push('/(main)/logros')} accessibilityLabel="Ver logros e insignias">
          <View className="bg-surface border border-border rounded-3xl p-4 mb-4 flex-row items-center gap-3">
            <IconBadge colors={gradients.gold} size={42} radius={14}>
              <Trophy color="#422006" size={20} />
            </IconBadge>
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">Logros e insignias</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Mira lo que has desbloqueado y lo que te falta</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </View>
        </PressableScale>
      </FadeIn>

      {/* Mapa muscular */}
      <FadeIn delay={525}>
        <PressableScale onPress={() => router.push('/(main)/cuerpo')} accessibilityLabel="Abrir mi mapa muscular">
          <View className="rounded-3xl overflow-hidden p-4 mb-4 flex-row items-center gap-3" style={{ borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' }}>
            <GradientFill colors={['#1e1b4b', '#141b19']} direction="horizontal" />
            <IconBadge colors={gradients.violet} size={42} radius={14}>
              <PersonStanding color="#ffffff" size={20} />
            </IconBadge>
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">Tu mapa muscular 3D</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Mira qué músculos dominas y compárate con tus amigos</Text>
            </View>
            <ChevronRight color={colors.violet} size={18} />
          </View>
        </PressableScale>
      </FadeIn>

      {/* Consejo del dia */}
      <FadeIn delay={560}>
        <View className="bg-surface border border-border rounded-3xl p-5">
          <View className="flex-row items-center gap-3 mb-3">
            <IconBadge colors={gradients.ocean} size={34} radius={11}>
              <Droplet color="#04120a" size={16} />
            </IconBadge>
            <Text className="text-white font-bold text-sm">Consejo del día</Text>
          </View>
          <Text className="text-gray-400 text-sm leading-5">{tipOfDay}</Text>
        </View>
      </FadeIn>
    </ScrollView>
  )
}
