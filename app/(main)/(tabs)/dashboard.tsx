import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, RefreshControl, Animated } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import { Weight, Ruler, Dumbbell, Flame, Play, Droplet, Trophy, ChevronRight, Plus, PersonStanding } from 'lucide-react-native'
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
  const [latestRoutine, setLatestRoutine] = useState<{ id: string; title: string; dayTitle: string; exerciseCount: number } | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, weight_kg, height_cm')
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

    // Racha de dias consecutivos
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    const uniqueDates = Array.from(new Set((logs || []).map((l) => l.date))).sort().reverse()
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

    // Rutina mas reciente (para "Tu rutina de hoy")
    const { data: routine } = await supabase
      .from('routines')
      .select('id, title, routine_days(id, day_number, title, routine_exercises(id))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (routine) {
      const days = [...(routine.routine_days || [])].sort((a: any, b: any) => a.day_number - b.day_number)
      const firstDay: any = days[0]
      setLatestRoutine({
        id: routine.id,
        title: routine.title,
        dayTitle: firstDay?.title || routine.title,
        exerciseCount: firstDay?.routine_exercises?.length || 0,
      })
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
          onPress={() => router.push(latestRoutine ? `/(main)/entrenar/${latestRoutine.id}` : '/(main)/(tabs)/rutinas')}
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
