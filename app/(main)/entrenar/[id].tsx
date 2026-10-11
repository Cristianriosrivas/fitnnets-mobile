import { useState, useEffect, useCallback } from 'react'
import { View, Text, Pressable, Image, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2, X, SkipForward } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'

type FlatExercise = {
  id: string
  exercise_id: string
  name: string
  gif_url: string | null
  sets: number
  reps: string
  rest_seconds: number
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
    logProgress(currentExercise.id, currentExercise.sets, currentExercise.reps)
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1)
      setCurrentSet(1)
      setPhase('exercise')
    } else {
      setPhase('done')
    }
  }

  const handleCompleteSet = () => {
    if (!currentExercise) return
    setSecondsLeft(currentExercise.rest_seconds)
    setPhase('resting')
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Cargando rutina...</Text>
      </View>
    )
  }

  if (!selectedDay) {
    return (
      <View className="flex-1 bg-background px-4 pt-16">
        <Text className="text-white text-xl font-bold mb-1">¿Qué día vas a entrenar?</Text>
        <Text className="text-gray-400 text-sm mb-6">Elige el día de tu rutina</Text>
        {days.map((day) => (
          <Pressable
            key={day.id}
            onPress={() => startDay(day)}
            className="bg-surface border border-border rounded-xl p-4 mb-3"
          >
            <Text className="text-white font-semibold">{day.title}</Text>
            <Text className="text-gray-400 text-xs">{day.routine_exercises?.length || 0} ejercicios</Text>
          </Pressable>
        ))}
      </View>
    )
  }

  if (phase === 'done') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <CheckCircle2 color="#22c55e" size={56} />
        <Text className="text-white text-2xl font-bold mt-4 text-center">
          ¡Entrenamiento completado! 🎉
        </Text>
        <Text className="text-gray-400 mt-2 text-center">Excelente trabajo, sigue así.</Text>
        <Pressable
          onPress={() => router.replace('/(main)/rutinas')}
          className="bg-primary rounded-xl px-6 py-3 mt-6"
        >
          <Text className="text-black font-semibold">Volver a rutinas</Text>
        </Pressable>
      </View>
    )
  }

  if (phase === 'resting') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-gray-400 text-sm mb-2">Descanso</Text>
        <Text className="text-primary text-6xl font-bold mb-6">{secondsLeft}s</Text>
        <Pressable onPress={goToNextStep} className="flex-row items-center gap-2">
          <SkipForward color="#9ca8a5" size={16} />
          <Text className="text-gray-400 text-sm font-medium">Saltar descanso</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-400 text-xs">
          Ejercicio {currentIndex + 1} de {queue.length}
        </Text>
        <Pressable onPress={() => router.replace('/(main)/rutinas')}>
          <X color="#6b7876" size={20} />
        </Pressable>
      </View>

      {currentExercise?.gif_url ? (
        <Image
          source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${currentExercise.gif_url}` }}
          className="w-full aspect-square rounded-2xl bg-surface2 mb-5"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full aspect-square rounded-2xl bg-surface2 mb-5" />
      )}

      <Text className="text-white text-xl font-bold">{currentExercise?.name}</Text>
      <Text className="text-gray-400 text-sm mt-1">
        Serie {currentSet} de {currentExercise?.sets} · {currentExercise?.reps} repeticiones
      </Text>

      <Pressable
        onPress={handleCompleteSet}
        className="bg-primary rounded-xl py-4 items-center mt-8"
      >
        <Text className="text-black font-semibold">Completar serie</Text>
      </Pressable>
    </ScrollView>
  )
}