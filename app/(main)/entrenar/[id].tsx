import { useState, useEffect, useRef } from 'react'
import { View, Text, Pressable, Image, ScrollView, Animated, Easing, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  X, SkipForward, ArrowLeft, Play, Check, Dumbbell, Repeat, Layers, Timer, Minus, Plus, TrendingUp,
  Sparkles, PersonStanding, Medal, Gem, Crown, Flame, Weight, Trophy, Target, Clock,
} from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import { checkNewBadges } from '../../../core/appChecks'
import {
  ExerciseInfo, ExerciseResult, RankTier, Recommendation, TrainingProfile, WeightHistory, WorkoutReport,
  buildWorkoutReport, formatDuration, isBodyweight, loadWeightHistory, parseWeight, recommendWeight,
  saveExerciseLog, weightStepFor,
} from '../../../core/training'
import FadeIn from '../../../components/ui/FadeIn'
import PressableScale from '../../../components/ui/PressableScale'
import GradientButton from '../../../components/ui/GradientButton'
import GradientFill from '../../../components/ui/GradientFill'
import IconBadge from '../../../components/ui/IconBadge'
import AnimatedRing from '../../../components/ui/AnimatedRing'
import TiltCard from '../../../components/ui/TiltCard'
import CountUp from '../../../components/ui/CountUp'
import Confetti from '../../../components/ui/Confetti'
import Skeleton from '../../../components/ui/Skeleton'
import { GlowOrb } from '../../../components/ui/Aurora'
import { colors, glow, gradients, GradientColors } from '../../../components/ui/theme'

type FlatExercise = {
  id: string
  info: ExerciseInfo
  gif_url: string | null
  sets: number
  reps: string
  rest_seconds: number
}

const DAY_GRADIENTS = [gradients.brand, gradients.ocean, gradients.violet, gradients.ember, gradients.gold]

const TIER_STYLE: Record<RankTier, { colors: GradientColors; text: string; icon: typeof Medal }> = {
  Bronce: { colors: ['#f59e0b', '#b45309', '#78350f'], text: '#fff7ed', icon: Medal },
  Plata: { colors: ['#f3f4f6', '#9ca3af', '#4b5563'], text: '#111827', icon: Medal },
  Oro: { colors: ['#fde047', '#f59e0b', '#b45309'], text: '#422006', icon: Trophy },
  Platino: { colors: ['#a5f3fc', '#22d3ee', '#0e7490'], text: '#083344', icon: Gem },
  Diamante: { colors: ['#c4b5fd', '#818cf8', '#22d3ee'], text: '#1e1b4b', icon: Crown },
}

const RECOMMENDATION_ICON = { subir: TrendingUp, mantener: Repeat, inicial: Sparkles, corporal: PersonStanding }

// Barra superior que avanza con cada ejercicio
function ProgressBar({ value }: { value: number }) {
  const progress = useRef(new Animated.Value(value)).current
  useEffect(() => {
    Animated.timing(progress, { toValue: value, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [value, progress])
  return (
    <View className="h-2 rounded-full bg-surface2 overflow-hidden flex-1 mx-3">
      <Animated.View style={{ flex: 1, borderRadius: 999, overflow: 'hidden', transformOrigin: 'left', transform: [{ scaleX: progress }] }}>
        <GradientFill colors={gradients.brand} direction="horizontal" />
      </Animated.View>
    </View>
  )
}

// Puntos de las series: hechas en verde, la actual late, las que faltan en gris
function SetDots({ total, current }: { total: number; current: number }) {
  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <View className="flex-row gap-2 mt-4">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        if (n === current) {
          return (
            <Animated.View
              key={n}
              style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}
            />
          )
        }
        return <View key={n} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n < current ? colors.primary : colors.surface2 }} />
      })}
    </View>
  )
}

function ClockChip({ seconds, label }: { seconds: number; label?: string }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-surface2 border border-border rounded-full px-3 py-1.5">
      <Timer color={colors.primary} size={13} />
      <Text className="text-white text-xs font-bold" style={{ fontVariant: ['tabular-nums'] }}>
        {(label ? label + ' ' : '') + formatDuration(seconds)}
      </Text>
    </View>
  )
}

// Peso del ejercicio: -/+ por pasos, teclado numérico (acepta coma o punto) y sugerencia
function WeightCard({
  info, value, onChange, recommendation,
}: {
  info: ExerciseInfo
  value: string
  onChange: (text: string) => void
  recommendation: Recommendation | null
}) {
  const bodyweight = isBodyweight(info)
  const step = weightStepFor(info)
  const nudge = (delta: number) => {
    const current = parseWeight(value) ?? 0
    const next = Math.max(0, Math.round((current + delta) * 100) / 100)
    onChange(String(next))
  }
  const RecIcon = recommendation ? RECOMMENDATION_ICON[recommendation.kind] : Sparkles
  const suggested = recommendation?.weightKg ?? null
  const showUse = suggested !== null && parseWeight(value) !== suggested

  return (
    <View className="bg-surface border border-border rounded-3xl p-4 mt-5">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Weight color={colors.primary} size={16} />
          <Text className="text-white font-bold text-sm">{bodyweight ? 'Lastre (opcional)' : 'Peso de hoy'}</Text>
        </View>
        {recommendation?.lastWeight !== null && recommendation?.lastWeight !== undefined ? (
          <Text className="text-gray-400 text-xs">{'Última vez: ' + recommendation.lastWeight + ' kg'}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3">
        <PressableScale onPress={() => nudge(-step)} accessibilityLabel={`Bajar ${step} kilos`}>
          <View className="w-12 h-12 rounded-2xl bg-surface2 border border-border items-center justify-center">
            <Minus color={colors.text} size={18} />
          </View>
        </PressableScale>
        <View className="flex-1 flex-row items-center justify-center bg-surface2 border border-border rounded-2xl" style={{ height: 56 }}>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            placeholder={bodyweight ? '0' : '--'}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Peso en kilos"
            style={{ color: colors.text, fontSize: 28, fontWeight: '800', minWidth: 70, textAlign: 'center' }}
          />
          <Text className="text-gray-400 text-base font-semibold">kg</Text>
        </View>
        <PressableScale onPress={() => nudge(step)} accessibilityLabel={`Subir ${step} kilos`}>
          <View className="w-12 h-12 rounded-2xl bg-surface2 border border-border items-center justify-center">
            <Plus color={colors.text} size={18} />
          </View>
        </PressableScale>
      </View>

      {recommendation ? (
        <View className="flex-row items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl p-3 mt-3">
          <RecIcon color={colors.primary} size={18} />
          <Text className="text-gray-300 text-xs flex-1 leading-4">{recommendation.message}</Text>
          {showUse ? (
            <PressableScale onPress={() => onChange(String(suggested))} accessibilityLabel={`Usar ${suggested} kilos`}>
              <View className="bg-primary rounded-full px-3 py-1.5">
                <Text className="text-black text-xs font-extrabold">{'Usar ' + suggested + ' kg'}</Text>
              </View>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function StatTile({ icon, colors: gradient, label, children }: { icon: React.ReactNode; colors: GradientColors; label: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface border border-border rounded-3xl p-4 mb-3" style={{ width: '48.5%' }}>
      <IconBadge colors={gradient} size={32} radius={10}>
        {icon}
      </IconBadge>
      <Text className="text-gray-400 text-xs mt-3">{label}</Text>
      {children}
    </View>
  )
}

// Resumen final: rango, estadísticas, para qué sirvió y detalle por ejercicio
function WorkoutSummary({ report, results, onClose }: { report: WorkoutReport; results: ExerciseResult[]; onClose: () => void }) {
  const tier = TIER_STYLE[report.tier]
  const TierIcon = tier.icon
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 64, paddingBottom: 40 }}>
        <GlowOrb color={tier.colors[1]} size={420} style={{ top: -120, alignSelf: 'center' }} intensity={0.3} drift={10} />

        <FadeIn style={{ alignItems: 'center', marginBottom: 18 }}>
          <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
            Entrenamiento completado
          </Text>
          <Text className="text-white text-3xl font-extrabold mt-1 text-center">¡Gran trabajo! 💪</Text>
        </FadeIn>

        {/* Rango */}
        <FadeIn delay={120}>
          <TiltCard float glare radius={30} maxTilt={8} style={[{ marginBottom: 16 }, glow(tier.colors[1], 28, 0.45)]}>
            <View style={{ borderRadius: 30, overflow: 'hidden', padding: 22, alignItems: 'center' }}>
              <GradientFill colors={tier.colors} radius={30} />
              <Text style={{ color: tier.text, opacity: 0.75, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>RANGO DE LA SESIÓN</Text>
              <View className="w-20 h-20 rounded-full items-center justify-center my-3" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                <TierIcon color={tier.text} size={40} strokeWidth={2.2} />
              </View>
              <Text style={{ color: tier.text, fontSize: 34, fontWeight: '900' }}>{report.tier}</Text>
              <View className="flex-row items-end mt-1">
                <CountUp value={report.score} delay={300} style={{ color: tier.text, fontSize: 22, fontWeight: '800' }} />
                <Text style={{ color: tier.text, opacity: 0.7, fontSize: 13, marginBottom: 3, marginLeft: 2 }}>/100</Text>
              </View>
            </View>
          </TiltCard>
        </FadeIn>

        {/* Estadisticas */}
        <FadeIn delay={200}>
          <View className="flex-row flex-wrap justify-between">
            <StatTile icon={<Clock color="#04120a" size={15} />} colors={gradients.brand} label="Tiempo total">
              <Text className="text-white text-2xl font-extrabold">{formatDuration(report.totalSeconds)}</Text>
              <Text className="text-gray-500 text-[11px]">{'Estimado ' + formatDuration(report.estimatedSeconds)}</Text>
            </StatTile>
            <StatTile icon={<Weight color="#ffffff" size={15} />} colors={gradients.violet} label="Volumen movido">
              <View className="flex-row items-end">
                <CountUp value={Math.round(report.volumeKg)} delay={300} className="text-white text-2xl font-extrabold" />
                <Text className="text-gray-400 text-xs mb-1 ml-1">kg</Text>
              </View>
              <Text className="text-gray-500 text-[11px]">peso × series × reps</Text>
            </StatTile>
            <StatTile icon={<Flame color="#ffffff" size={15} />} colors={gradients.ember} label="Calorías aprox.">
              <View className="flex-row items-end">
                <CountUp value={report.calories} delay={300} className="text-white text-2xl font-extrabold" />
                <Text className="text-gray-400 text-xs mb-1 ml-1">kcal</Text>
              </View>
            </StatTile>
            <StatTile icon={<Trophy color="#422006" size={15} />} colors={gradients.gold} label="Récords personales">
              <Text className="text-white text-2xl font-extrabold">{report.personalRecords.length}</Text>
              <Text className="text-gray-500 text-[11px]" numberOfLines={1}>
                {report.personalRecords.length ? report.personalRecords.join(', ') : 'Sigue sumando'}
              </Text>
            </StatTile>
          </View>
        </FadeIn>

        {/* Por que este rango */}
        <FadeIn delay={260}>
          <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
            <Text className="text-white font-bold text-base mb-3">Por qué este rango</Text>
            {report.reasons.map((reason) => (
              <View key={reason} className="flex-row items-center gap-2.5 mb-2">
                <View className="w-5 h-5 rounded-full bg-green-500/20 items-center justify-center">
                  <Check color={colors.primary} size={12} strokeWidth={3} />
                </View>
                <Text className="text-gray-300 text-sm flex-1">{reason}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* Para que sirvio */}
        <FadeIn delay={320}>
          <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Target color={colors.primary} size={18} />
              <Text className="text-white font-bold text-base">¿Para qué te sirvió?</Text>
            </View>
            <Text className="text-gray-400 text-sm leading-5 mb-4">{report.purpose}</Text>
            {report.muscles.map((m, i) => (
              <View key={m.group} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-white text-sm font-semibold">{m.label}</Text>
                  <Text className="text-gray-400 text-xs">{m.sets + (m.sets === 1 ? ' serie' : ' series')}</Text>
                </View>
                <View className="h-2 rounded-full bg-surface2 overflow-hidden">
                  <View style={{ width: `${Math.max(8, m.share * 100)}%`, height: '100%', borderRadius: 999, overflow: 'hidden' }}>
                    <GradientFill colors={DAY_GRADIENTS[i % DAY_GRADIENTS.length]} direction="horizontal" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* Detalle por ejercicio */}
        <FadeIn delay={380}>
          <View className="bg-surface border border-border rounded-3xl p-5 mb-6">
            <Text className="text-white font-bold text-base mb-3">Tu sesión</Text>
            {results.map((r, i) => {
              const record = report.personalRecords.includes(r.exercise.name)
              return (
                <View key={i} className={`flex-row items-center gap-3 py-2.5 ${i < results.length - 1 ? 'border-b border-border' : ''}`}>
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">{r.exercise.name}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">
                      {r.sets + ' × ' + r.reps + ' · ' + (r.weightKg ? r.weightKg + ' kg' : isBodyweight(r.exercise) ? 'Peso corporal' : 'Sin peso')}
                    </Text>
                  </View>
                  {record ? (
                    <View className="bg-yellow-500/15 rounded-full px-2 py-0.5">
                      <Text className="text-yellow-400 text-[10px] font-extrabold">RÉCORD</Text>
                    </View>
                  ) : null}
                  <Text className="text-gray-400 text-xs" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatDuration(r.durationSeconds)}
                  </Text>
                </View>
              )
            })}
          </View>
        </FadeIn>

        <GradientButton title="Volver" onPress={onClose} icon={<Check color="#04120a" size={18} strokeWidth={3} />} />
      </ScrollView>
      <Confetti />
    </View>
  )
}

export default function EntrenarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<any | null>(null)
  const [queue, setQueue] = useState<FlatExercise[]>([])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [phase, setPhase] = useState<'exercise' | 'resting' | 'done'>('exercise')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [restRound, setRestRound] = useState(0)

  // Cronometro: inicio de la sesion y del ejercicio actual; "now" avanza cada segundo
  const [now, setNow] = useState(Date.now())
  const sessionStart = useRef(0)
  const exerciseStart = useRef(0)

  const [profile, setProfile] = useState<TrainingProfile>({ weightKg: null, gender: null, goal: null, activityLevel: null })
  const [history, setHistory] = useState<WeightHistory>({})
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [results, setResults] = useState<ExerciseResult[]>([])
  const [report, setReport] = useState<WorkoutReport | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: { user } }] = await Promise.all([
        supabase
          .from('routine_days')
          .select('id, day_number, title, routine_exercises(id, exercise_id, sets, reps, rest_seconds, order_index, exercises(name, gif_url, muscle_group, equipment, difficulty))')
          .eq('routine_id', id)
          .order('day_number', { ascending: true }),
        supabase.auth.getUser(),
      ])
      setDays(data || [])

      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('weight_kg, gender, goal, activity_level')
          .eq('id', user.id)
          .single()
        if (p) setProfile({ weightKg: p.weight_kg ? Number(p.weight_kg) : null, gender: p.gender, goal: p.goal, activityLevel: p.activity_level })
      }
      setLoading(false)
    }
    load()
  }, [id])

  // El reloj corre mientras se entrena
  useEffect(() => {
    if (!selectedDay || phase === 'done') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [selectedDay, phase])

  const startDay = async (day: any) => {
    const flat: FlatExercise[] = [...day.routine_exercises]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((ex: any) => ({
        id: ex.id,
        info: {
          exerciseId: ex.exercise_id,
          name: ex.exercises?.name || 'Ejercicio',
          muscleGroup: ex.exercises?.muscle_group ?? null,
          equipment: ex.exercises?.equipment ?? null,
          difficulty: ex.exercises?.difficulty ?? null,
        },
        gif_url: ex.exercises?.gif_url,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds || 60,
      }))
    setQueue(flat)
    setSelectedDay(day)
    setCurrentIndex(0)
    setCurrentSet(1)
    setPhase('exercise')
    setResults([])
    sessionStart.current = Date.now()
    exerciseStart.current = Date.now()
    setNow(Date.now())

    const { data: { user } } = await supabase.auth.getUser()
    if (user) setHistory(await loadWeightHistory(user.id, flat.map((f) => f.info.exerciseId)))
  }

  useEffect(() => {
    if (phase !== 'resting') return
    if (secondsLeft <= 0) {
      goToNextStep()
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft])

  const currentExercise = queue[currentIndex]
  const currentHistory = currentExercise ? history[currentExercise.info.exerciseId] || [] : []
  const recommendation = currentExercise ? recommendWeight(currentExercise.info, currentHistory, profile) : null

  // Al llegar a cada ejercicio, el campo de peso arranca con la sugerencia
  useEffect(() => {
    if (!currentExercise || weights[currentExercise.id] !== undefined || !recommendation) return
    if (recommendation.weightKg !== null && !isBodyweight(currentExercise.info)) {
      setWeights((w) => ({ ...w, [currentExercise.id]: String(recommendation.weightKg) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise?.id, history])

  const finishExercise = () => {
    if (!currentExercise) return Promise.resolve()
    const durationSeconds = Math.round((Date.now() - exerciseStart.current) / 1000)
    const weightKg = parseWeight(weights[currentExercise.id] || '')
    const result: ExerciseResult = {
      exercise: currentExercise.info,
      sets: currentExercise.sets,
      reps: currentExercise.reps,
      restSeconds: currentExercise.rest_seconds,
      weightKg: weightKg && weightKg > 0 ? weightKg : null,
      durationSeconds,
      previous: currentHistory,
    }
    setResults((r) => [...r, result])
    exerciseStart.current = Date.now()

    return supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      return saveExerciseLog({
        userId: user.id,
        routineExerciseId: currentExercise.id,
        exerciseId: currentExercise.info.exerciseId,
        sets: currentExercise.sets,
        reps: currentExercise.reps,
        weightKg: result.weightKg,
        durationSeconds,
      }).then(() => undefined)
    })
  }

  const goToNextStep = () => {
    if (!currentExercise) return
    if (currentSet < currentExercise.sets) {
      setCurrentSet((s) => s + 1)
      setPhase('exercise')
      return
    }
    const logged = finishExercise()
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1)
      setCurrentSet(1)
      setPhase('exercise')
    } else {
      setPhase('done')
      // Cuando se guarda el ultimo ejercicio, revisa si el entrenamiento desbloqueo insignias
      logged.then(() => checkNewBadges())
    }
  }

  // El informe se arma una vez, con todos los resultados ya acumulados
  useEffect(() => {
    if (phase !== 'done' || report || results.length !== queue.length) return
    const totalSeconds = Math.round((Date.now() - sessionStart.current) / 1000)
    setReport(buildWorkoutReport(results, totalSeconds, profile))
  }, [phase, results, queue.length, report, profile])

  const handleCompleteSet = () => {
    if (!currentExercise) return
    setSecondsLeft(currentExercise.rest_seconds)
    setRestRound((r) => r + 1)
    setPhase('resting')
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background px-4" style={{ paddingTop: 64 }}>
        <Skeleton height={28} width={220} radius={10} />
        <Skeleton height={86} radius={22} style={{ marginTop: 24 }} />
        <Skeleton height={86} radius={22} style={{ marginTop: 12 }} />
        <Skeleton height={86} radius={22} style={{ marginTop: 12 }} />
      </View>
    )
  }

  // ----- Elegir el dia -----
  if (!selectedDay) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-5 self-start">
          <ArrowLeft color={colors.soft} size={22} />
        </Pressable>
        <FadeIn>
          <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
            Hora de entrenar
          </Text>
          <Text className="text-white text-3xl font-extrabold mt-1">¿Qué día vas a entrenar?</Text>
          <Text className="text-gray-400 text-sm mt-1 mb-6">Elige el día de tu rutina</Text>
        </FadeIn>
        {days.length === 0 ? (
          <Text className="text-gray-400 text-center mt-10">Esta rutina todavía no tiene días.</Text>
        ) : null}
        {days.map((day, i) => (
          <FadeIn key={day.id} delay={80 + i * 70}>
            <PressableScale onPress={() => startDay(day)} accessibilityLabel={'Entrenar ' + day.title}>
              <View className="bg-surface border border-border rounded-3xl p-4 mb-3 flex-row items-center gap-4">
                <IconBadge colors={DAY_GRADIENTS[i % DAY_GRADIENTS.length]} size={48} radius={16}>
                  <Text style={{ color: '#04120a', fontWeight: '900', fontSize: 18 }}>{i + 1}</Text>
                </IconBadge>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">{day.title}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{(day.routine_exercises?.length || 0) + ' ejercicios'}</Text>
                </View>
                <View className="bg-primary rounded-full p-2.5" style={glow(colors.primary, 10, 0.5)}>
                  <Play color="#04120a" size={14} fill="#04120a" />
                </View>
              </View>
            </PressableScale>
          </FadeIn>
        ))}
      </ScrollView>
    )
  }

  // ----- Terminado -----
  if (phase === 'done') {
    if (!report) {
      return (
        <View className="flex-1 bg-background items-center justify-center">
          <Skeleton height={220} width="88%" radius={30} />
        </View>
      )
    }
    return <WorkoutSummary report={report} results={results} onClose={() => router.back()} />
  }

  const totalSeconds = Math.round((now - sessionStart.current) / 1000)
  const exerciseSeconds = Math.round((now - exerciseStart.current) / 1000)

  const nextLabel = currentExercise
    ? currentSet < currentExercise.sets
      ? `Serie ${currentSet + 1} de ${currentExercise.sets}`
      : queue[currentIndex + 1]?.info.name || 'Terminar'
    : ''

  // ----- Descanso -----
  if (phase === 'resting') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <GlowOrb color={colors.primary} size={380} intensity={0.3} drift={8} duration={2400} />
        <View className="absolute top-16 right-4">
          <ClockChip seconds={totalSeconds} />
        </View>
        <Text className="text-gray-400 text-xs font-bold uppercase mb-6" style={{ letterSpacing: 3 }}>
          Descanso
        </Text>
        <AnimatedRing key={restRound} progress={0} from={100} duration={(currentExercise?.rest_seconds || 60) * 1000} linear size={250} stroke={14}>
          <Text className="text-white font-extrabold" style={{ fontSize: 64, lineHeight: 70 }}>
            {secondsLeft}
          </Text>
          <Text className="text-gray-400 text-sm">segundos</Text>
        </AnimatedRing>
        <View className="bg-surface border border-border rounded-2xl px-4 py-3 mt-8 items-center">
          <Text className="text-gray-500 text-xs">Siguiente</Text>
          <Text className="text-white font-semibold mt-0.5">{nextLabel}</Text>
        </View>
        <PressableScale onPress={goToNextStep} accessibilityLabel="Saltar descanso" style={{ marginTop: 20 }}>
          <View className="flex-row items-center gap-2 px-5 py-3 rounded-full border border-border">
            <SkipForward color={colors.soft} size={16} />
            <Text className="text-gray-300 text-sm font-semibold">Saltar descanso</Text>
          </View>
        </PressableScale>
      </View>
    )
  }

  // ----- Ejercicio -----
  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} accessibilityLabel="Salir del entrenamiento" hitSlop={12}>
            <X color={colors.muted} size={22} />
          </Pressable>
          <ProgressBar value={(currentIndex + (currentSet - 1) / Math.max(1, currentExercise?.sets || 1)) / queue.length} />
          <Text className="text-gray-400 text-xs font-semibold">{currentIndex + 1 + '/' + queue.length}</Text>
        </View>
        <View className="flex-row justify-end mb-4">
          <ClockChip seconds={totalSeconds} label="Total" />
        </View>

        <FadeIn key={currentExercise?.id}>
          <View className="rounded-3xl overflow-hidden border border-border mb-5" style={glow(colors.primary, 20, 0.18)}>
            {currentExercise?.gif_url ? (
              <Image
                source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${currentExercise.gif_url}` }}
                className="w-full aspect-square bg-surface2"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full aspect-square items-center justify-center">
                <GradientFill colors={gradients.steel} />
                <Dumbbell color={colors.muted} size={72} />
              </View>
            )}
          </View>

          <Text className="text-white text-2xl font-extrabold">{currentExercise?.info.name}</Text>
          <View className="flex-row flex-wrap gap-2 mt-3">
            <View className="flex-row items-center gap-1.5 bg-green-500/15 rounded-full px-3 py-1.5">
              <Layers color={colors.primary} size={13} />
              <Text className="text-primary text-xs font-bold">{'Serie ' + currentSet + ' de ' + currentExercise?.sets}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-surface2 rounded-full px-3 py-1.5">
              <Repeat color={colors.soft} size={13} />
              <Text className="text-gray-300 text-xs font-semibold">{currentExercise?.reps + ' repeticiones'}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-surface2 rounded-full px-3 py-1.5">
              <Timer color={colors.soft} size={13} />
              <Text className="text-gray-300 text-xs font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                {'En este ejercicio ' + formatDuration(exerciseSeconds)}
              </Text>
            </View>
          </View>
          <SetDots total={currentExercise?.sets || 1} current={currentSet} />
        </FadeIn>

        {currentExercise ? (
          <WeightCard
            info={currentExercise.info}
            value={weights[currentExercise.id] ?? ''}
            onChange={(text) => setWeights((w) => ({ ...w, [currentExercise.id]: text }))}
            recommendation={recommendation}
          />
        ) : null}

        <GradientButton
          title="Completar serie"
          onPress={handleCompleteSet}
          icon={<Check color="#04120a" size={18} strokeWidth={3} />}
          style={{ marginTop: 22 }}
        />
        <Text className="text-gray-500 text-xs text-center mt-3">{'Después: ' + nextLabel}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
