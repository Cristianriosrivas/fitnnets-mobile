import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Plus, Trash2, ArrowLeft } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

type ExerciseCatalogItem = { id: string; name: string }
type DayExercise = { exercise_id: string; name: string; sets: number; reps: string; rest_seconds: number }
type DayBlock = { title: string; exercises: DayExercise[] }

export default function NuevaRutinaScreen() {
  const router = useRouter()
  // Si vienen estos parametros, la rutina se crea PARA un amigo (desde Social)
  const params = useLocalSearchParams<{ friendId?: string; friendName?: string }>()
  const friendId = typeof params.friendId === 'string' ? params.friendId : undefined
  const friendName = typeof params.friendName === 'string' ? params.friendName : ''
  const forFriend = !!friendId

  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([])
  const [routineTitle, setRoutineTitle] = useState('')
  const [days, setDays] = useState<DayBlock[]>([{ title: 'Día 1', exercises: [] }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadCatalog = async () => {
      const { data } = await supabase.from('exercises').select('id, name').order('name')
      setCatalog(data || [])
    }
    loadCatalog()
  }, [])

  // Al cambiar de destinatario (o volver a entrar), el formulario empieza limpio
  useEffect(() => {
    setRoutineTitle('')
    setDays([{ title: 'Día 1', exercises: [] }])
    setError('')
  }, [friendId])

  const addDay = () => {
    setDays((prev) => [...prev, { title: 'Día ' + (prev.length + 1), exercises: [] }])
  }

  const removeDay = (dayIndex: number) => {
    setDays((prev) => prev.filter((_, i) => i !== dayIndex))
  }

  const updateDayTitle = (dayIndex: number, title: string) => {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, title } : d)))
  }

  const addExerciseToDay = (dayIndex: number) => {
    if (catalog.length === 0) return
    const first = catalog[0]
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                { exercise_id: first.id, name: first.name, sets: 3, reps: '10-12', rest_seconds: 60 },
              ],
            }
          : d
      )
    )
  }

  const removeExerciseFromDay = (dayIndex: number, exIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIndex) } : d))
    )
  }

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof DayExercise, value: string | number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const newExercises = d.exercises.map((ex, j) => {
          if (j !== exIndex) return ex
          if (field === 'exercise_id') {
            const found = catalog.find((c) => c.id === value)
            return { ...ex, exercise_id: value as string, name: found?.name || ex.name }
          }
          return { ...ex, [field]: value }
        })
        return { ...d, exercises: newExercises }
      })
    )
  }

  const handleSave = async () => {
    setError('')
    if (!routineTitle.trim()) {
      setError('Ponle un nombre a tu rutina')
      return
    }
    if (days.some((d) => d.exercises.length === 0)) {
      setError('Cada día debe tener al menos un ejercicio')
      return
    }
    setSaving(true)

    // --- Rutina para un amigo: la crea la funcion assign_routine en Supabase ---
    if (forFriend) {
      const { error: rpcError } = await supabase.rpc('assign_routine', {
        p_friend_id: friendId,
        p_title: routineTitle,
        p_days: days.map((d) => ({
          title: d.title,
          exercises: d.exercises.map((ex) => ({
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
          })),
        })),
      })

      setSaving(false)
      if (rpcError) {
        setError(rpcError.message)
        return
      }

      setRoutineTitle('')
      setDays([{ title: 'Día 1', exercises: [] }])
      Alert.alert('Rutina enviada', friendName + ' la vera en su lista de rutinas, con tu nombre como creador.', [
        { text: 'OK', onPress: () => router.replace('/(main)/social') },
      ])
      return
    }

    // --- Rutina propia ---
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sesión no encontrada')
      setSaving(false)
      return
    }

    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .insert({ user_id: user.id, title: routineTitle, generated_by_ai: false })
      .select()
      .single()

    if (routineError) {
      setError(routineError.message)
      setSaving(false)
      return
    }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const { data: routineDay, error: dayError } = await supabase
        .from('routine_days')
        .insert({ routine_id: routine.id, day_number: i + 1, title: day.title })
        .select()
        .single()

      if (dayError) {
        setError(dayError.message)
        setSaving(false)
        return
      }

      const exercisesToInsert = day.exercises.map((ex, index) => ({
        routine_day_id: routineDay.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        order_index: index,
      }))

      const { error: exError } = await supabase.from('routine_exercises').insert(exercisesToInsert)

      if (exError) {
        setError(exError.message)
        setSaving(false)
        return
      }
    }

    setRoutineTitle('')
    setDays([{ title: 'Día 1', exercises: [] }])
    setSaving(false)
    router.replace('/(main)/rutinas')
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <View className="flex-row items-center gap-3 mb-5">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color="#9ca8a5" size={20} />
        </Pressable>
        <Text className="text-white text-xl font-bold">
          {forFriend ? 'Rutina para ' + friendName : 'Crear rutina personalizada'}
        </Text>
      </View>

      {forFriend && (
        <View className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-5">
          <Text className="text-blue-300 text-xs">
            {'Esta rutina aparecera en la lista de ' + friendName + ' con tu nombre como creador.'}
          </Text>
        </View>
      )}

      <Text className="text-gray-400 text-xs mb-1">Nombre de la rutina</Text>
      <TextInput
        value={routineTitle}
        onChangeText={setRoutineTitle}
        placeholder="ej: Mi rutina de fuerza"
        placeholderTextColor="#6b7876"
        className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-5"
      />

      {days.map((day, dayIndex) => (
        <View key={dayIndex} className="bg-surface border border-border rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <TextInput
              value={day.title}
              onChangeText={(text) => updateDayTitle(dayIndex, text)}
              className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-white font-semibold"
            />
            {days.length > 1 && (
              <Pressable onPress={() => removeDay(dayIndex)}>
                <Trash2 color="#6b7876" size={18} />
              </Pressable>
            )}
          </View>

          {day.exercises.map((ex, exIndex) => (
            <View key={exIndex} className="bg-surface2 rounded-lg p-3 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-400 text-xs">Ejercicio</Text>
                <Pressable onPress={() => removeExerciseFromDay(dayIndex, exIndex)}>
                  <Trash2 color="#6b7876" size={16} />
                </Pressable>
              </View>

              <View className="bg-background border border-border rounded-lg mb-2">
                <Picker
                  selectedValue={ex.exercise_id}
                  onValueChange={(value) => updateExercise(dayIndex, exIndex, 'exercise_id', value)}
                  style={{ color: 'white' }}
                  dropdownIconColor="#9ca8a5"
                >
                  {catalog.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} color="black" />
                  ))}
                </Picker>
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-gray-500 text-[10px] mb-1">Series</Text>
                  <TextInput
                    value={String(ex.sets)}
                    onChangeText={(v) => updateExercise(dayIndex, exIndex, 'sets', parseInt(v) || 0)}
                    keyboardType="number-pad"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-white text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-[10px] mb-1">Reps</Text>
                  <TextInput
                    value={ex.reps}
                    onChangeText={(v) => updateExercise(dayIndex, exIndex, 'reps', v)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-white text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-[10px] mb-1">Desc. (s)</Text>
                  <TextInput
                    value={String(ex.rest_seconds)}
                    onChangeText={(v) => updateExercise(dayIndex, exIndex, 'rest_seconds', parseInt(v) || 0)}
                    keyboardType="number-pad"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-white text-sm"
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable onPress={() => addExerciseToDay(dayIndex)} className="flex-row items-center gap-1.5">
            <Plus color="#22c55e" size={16} />
            <Text className="text-primary text-sm font-medium">Agregar ejercicio</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={addDay} className="flex-row items-center gap-1.5 mb-5">
        <Plus color="#9ca8a5" size={16} />
        <Text className="text-gray-400 text-sm font-medium">Agregar otro día</Text>
      </Pressable>

      {error ? <Text className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-4">{error}</Text> : null}

      <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-3.5 items-center">
        <Text className="text-black font-semibold">
          {saving ? 'Guardando...' : forFriend ? 'Enviar rutina a ' + friendName : 'Guardar rutina'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}