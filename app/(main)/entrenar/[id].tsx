import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Pressable, Image, ScrollView, Animated, Easing } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { X, SkipForward, ArrowLeft, Play, Check, Dumbbell, Trophy, Repeat, Layers } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import { checkNewBadges } from '../../../core/appChecks'
import FadeIn from '../../../components/ui/FadeIn'
import PressableScale from '../../../components/ui/PressableScale'
import GradientButton from '../../../components/ui/GradientButton'
import GradientFill from '../../../components/ui/GradientFill'
import IconBadge from '../../../components/ui/IconBadge'
import AnimatedRing from '../../../components/ui/AnimatedRing'
import Confetti from '../../../components/ui/Confetti'
import Skeleton from '../../../components/ui/Skeleton'
import { GlowOrb } from '../../../components/ui/Aurora'
import { colors, glow, gradients } from '../../../components/ui/theme'

type FlatExercise = {
  id: string
  exercise_id: string
  name: string
  gif_url: string | null
  sets: number
  reps: string
  rest_seconds: number
}

const DAY_GRADIENTS = [gradients.brand, gradients.ocean, gradients.violet, gradients.ember, gradients.gold]

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
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              }}
            />
          )
        }
        return <View key={n} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n < current ? colors.primary : colors.surface2 }} />
      })}
    </View>
  )
}

// Trofeo que entra con rebote al terminar
function CelebrationTrophy() {
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 6, bounciness: 14 }).start()
  }, [pop])
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pop },
          { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
        ],
      }}
    >
      <IconBadge colors={gradients.gold} size={110} radius={36}>
        <Trophy color="#422006" size={54} strokeWidth={2.2} />
      </IconBadge>
    </Animated.View>
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

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('routine_days')
        .select('id, day_number, title, routine_exercises(id, exercise_id, sets, reps, rest_seconds, order_index, exercises(name, gif_url))')
        .eq('routine_id', id)
        .order('day_number', { ascending: true })

      setDays(data || [])
      setLoading(false)
    }
    load()
  }, [id])

  const startDay = (day: any) => {
    const flat: FlatExercise[] = day.routine_exercises
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((ex: any) => ({
        id: ex.id,
        exercise_id: ex.exercise_id,
        name: ex.exercises?.name || 'Ejercicio',
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

  const logProgress = useCallback(async (routineExerciseId: string, sets: number, reps: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('progress_logs').insert({
      user_id: user.id,
      routine_exercise_id: routineExerciseId,
      sets_completed: sets,
      reps_completed: reps,
    })
  }, [])

  const goToNextStep = () => {
    if (!currentExercise) return
    if (currentSet < currentExercise.sets) {
      setCurrentSet((s) => s + 1)
      setPhase('exercise')
      return
    }
    const logged = logProgress(currentExercise.id, currentExercise.sets, currentExercise.reps)
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
    const totalSets = queue.reduce((sum, ex) => sum + ex.sets, 0)
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <GlowOrb color={colors.gold} size={420} style={{ top: '18%' }} intensity={0.28} drift={10} />
        <CelebrationTrophy />
        <FadeIn delay={250} style={{ alignItems: 'center' }}>
          <Text className="text-white text-3xl font-extrabold mt-7 text-center">¡Entrenamiento completado!</Text>
          <Text className="text-gray-400 mt-2 text-center">Excelente trabajo, sigue así. 💪</Text>
          <View className="flex-row gap-3 mt-6">
            <View className="bg-surface border border-border rounded-2xl px-4 py-3 items-center">
              <Text className="text-white text-xl font-extrabold">{queue.length}</Text>
              <Text className="text-gray-400 text-xs">ejercicios</Text>
            </View>
            <View className="bg-surface border border-border rounded-2xl px-4 py-3 items-center">
              <Text className="text-white text-xl font-extrabold">{totalSets}</Text>
              <Text className="text-gray-400 text-xs">series</Text>
            </View>
          </View>
        </FadeIn>
        <FadeIn delay={450} style={{ alignSelf: 'stretch', marginTop: 32 }}>
          <GradientButton title="Volver" onPress={() => router.back()} icon={<Check color="#04120a" size={18} />} />
        </FadeIn>
        <Confetti />
      </View>
    )
  }

  const nextLabel = currentExercise
    ? currentSet < currentExercise.sets
      ? `Serie ${currentSet + 1} de ${currentExercise.sets}`
      : queue[currentIndex + 1]?.name || 'Terminar'
    : ''

  // ----- Descanso -----
  if (phase === 'resting') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <GlowOrb color={colors.primary} size={380} intensity={0.3} drift={8} duration={2400} />
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
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <View className="flex-row items-center mb-5">
        <Pressable onPress={() => router.back()} accessibilityLabel="Salir del entrenamiento" hitSlop={12}>
          <X color={colors.muted} size={22} />
        </Pressable>
        <ProgressBar value={(currentIndex + (currentSet - 1) / Math.max(1, currentExercise?.sets || 1)) / queue.length} />
        <Text className="text-gray-400 text-xs font-semibold">{currentIndex + 1 + '/' + queue.length}</Text>
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

        <Text className="text-white text-2xl font-extrabold">{currentExercise?.name}</Text>
        <View className="flex-row gap-2 mt-3">
          <View className="flex-row items-center gap-1.5 bg-green-500/15 rounded-full px-3 py-1.5">
            <Layers color={colors.primary} size={13} />
            <Text className="text-primary text-xs font-bold">{'Serie ' + currentSet + ' de ' + currentExercise?.sets}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 bg-surface2 rounded-full px-3 py-1.5">
            <Repeat color={colors.soft} size={13} />
            <Text className="text-gray-300 text-xs font-semibold">{currentExercise?.reps + ' repeticiones'}</Text>
          </View>
        </View>
        <SetDots total={currentExercise?.sets || 1} current={currentSet} />
      </FadeIn>

      <GradientButton
        title="Completar serie"
        onPress={handleCompleteSet}
        icon={<Check color="#04120a" size={18} strokeWidth={3} />}
        style={{ marginTop: 28 }}
      />
      <Text className="text-gray-500 text-xs text-center mt-3">{'Después: ' + nextLabel}</Text>
    </ScrollView>
  )
}
