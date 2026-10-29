import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Plus, Trash2, ArrowLeft, Dumbbell, Users, Send, Check } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import FadeIn from '../../components/ui/FadeIn'
import PressableScale from '../../components/ui/PressableScale'
import GradientButton from '../../components/ui/GradientButton'
import IconBadge from '../../components/ui/IconBadge'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, gradients } from '../../components/ui/theme'

// En iOS la rueda del selector va sobre la tarjeta oscura (texto blanco); en Android
// se abre una lista blanca (texto negro)
const PICKER_ITEM_COLOR = Platform.OS === 'ios' ? '#ffffff' : '#000000'
const DAY_GRADIENTS = [gradients.brand, gradients.ocean, gradients.violet, gradients.ember, gradients.gold]

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
        { text: 'OK', onPress: () => router.back() },
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

    // Si falla un dia o un ejercicio, se borra la rutina recien creada (sus dias caen en cascada)
    // para no dejar en la lista una rutina a medias sin ejercicios
    const rollback = async (message: string) => {
      await supabase.from('routines').delete().eq('id', routine.id)
      setError(message)
      setSaving(false)
    }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const { data: routineDay, error: dayError } = await supabase
        .from('routine_days')
        .insert({ routine_id: routine.id, day_number: i + 1, title: day.title })
        .select()
        .single()

      if (dayError) {
        await rollback(dayError.message)
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
        await rollback(exError.message)
        return
      }
    }

    setRoutineTitle('')
    setDays([{ title: 'Día 1', exercises: [] }])
    setSaving(false)
    // Vuelve a Rutinas, que recarga la lista al recibir el foco
    router.back()
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 48 }}
      >
        <GlowOrb color={forFriend ? colors.sky : colors.primary} size={340} style={{ top: -170, right: -130 }} intensity={0.24} />

        <FadeIn>
          <View className="flex-row items-end gap-3 mb-5">
            <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-1.5">
              <ArrowLeft color={colors.soft} size={22} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
                {forFriend ? 'Para un amigo' : 'A tu medida'}
              </Text>
              <Text className="text-white text-3xl font-extrabold mt-1" numberOfLines={2}>
                {forFriend ? 'Rutina para ' + friendName : 'Crear rutina'}
              </Text>
            </View>
          </View>
        </FadeIn>

        {forFriend && (
          <View className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-3 mb-5 flex-row items-center gap-3">
            <Users color={colors.sky} size={18} />
            <Text className="text-sky-300 text-xs flex-1">
              {'Esta rutina aparecerá en la lista de ' + friendName + ' con tu nombre como creador.'}
            </Text>
          </View>
        )}

        <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">Nombre de la rutina</Text>
        <TextInput
          value={routineTitle}
          onChangeText={setRoutineTitle}
          placeholder="ej: Mi rutina de fuerza"
          placeholderTextColor={colors.muted}
          className="bg-surface2 border border-border rounded-2xl px-4 py-3.5 text-white text-base mb-5"
        />

        {days.map((day, dayIndex) => (
          <FadeIn key={dayIndex} distance={10}>
            <View className="bg-surface border border-border rounded-3xl p-4 mb-4">
              <View className="flex-row items-center gap-3 mb-3">
                <IconBadge colors={DAY_GRADIENTS[dayIndex % DAY_GRADIENTS.length]} size={38} radius={12}>
                  <Text style={{ color: '#04120a', fontWeight: '900', fontSize: 15 }}>{dayIndex + 1}</Text>
                </IconBadge>
                <TextInput
                  value={day.title}
                  onChangeText={(text) => updateDayTitle(dayIndex, text)}
                  accessibilityLabel="Nombre del día"
                  className="flex-1 bg-surface2 border border-border rounded-xl px-3 py-2.5 text-white font-bold"
                />
                {days.length > 1 && (
                  <Pressable onPress={() => removeDay(dayIndex)} accessibilityLabel="Quitar día" hitSlop={10} className="p-1">
                    <Trash2 color={colors.muted} size={18} />
                  </Pressable>
                )}
              </View>

              {day.exercises.map((ex, exIndex) => (
                <View key={exIndex} className="bg-surface2 rounded-2xl p-3 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <Dumbbell color={colors.primary} size={14} />
                      <Text className="text-gray-300 text-xs font-semibold">{'Ejercicio ' + (exIndex + 1)}</Text>
                    </View>
                    <Pressable
                      onPress={() => removeExerciseFromDay(dayIndex, exIndex)}
                      accessibilityLabel="Quitar ejercicio"
                      hitSlop={10}
                    >
                      <Trash2 color={colors.muted} size={16} />
                    </Pressable>
                  </View>

                  <View className="bg-background border border-border rounded-xl mb-3 overflow-hidden">
                    <Picker
                      selectedValue={ex.exercise_id}
                      onValueChange={(value) => updateExercise(dayIndex, exIndex, 'exercise_id', value)}
                      style={{ color: 'white' }}
                      itemStyle={{ color: 'white', fontSize: 16 }}
                      dropdownIconColor={colors.soft}
                    >
                      {catalog.map((c) => (
                        <Picker.Item key={c.id} label={c.name} value={c.id} color={PICKER_ITEM_COLOR} />
                      ))}
                    </Picker>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[11px] mb-1 ml-1">Series</Text>
                      <TextInput
                        value={String(ex.sets)}
                        onChangeText={(v) => updateExercise(dayIndex, exIndex, 'sets', parseInt(v) || 0)}
                        keyboardType="number-pad"
                        className="bg-background border border-border rounded-xl px-3 py-2 text-white text-sm text-center"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[11px] mb-1 ml-1">Reps</Text>
                      <TextInput
                        value={ex.reps}
                        onChangeText={(v) => updateExercise(dayIndex, exIndex, 'reps', v)}
                        className="bg-background border border-border rounded-xl px-3 py-2 text-white text-sm text-center"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[11px] mb-1 ml-1">Descanso (s)</Text>
                      <TextInput
                        value={String(ex.rest_seconds)}
                        onChangeText={(v) => updateExercise(dayIndex, exIndex, 'rest_seconds', parseInt(v) || 0)}
                        keyboardType="number-pad"
                        className="bg-background border border-border rounded-xl px-3 py-2 text-white text-sm text-center"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <PressableScale onPress={() => addExerciseToDay(dayIndex)} accessibilityLabel="Agregar ejercicio">
                <View className="flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-green-500/40 py-3">
                  <Plus color={colors.primary} size={16} />
                  <Text className="text-primary text-sm font-semibold">Agregar ejercicio</Text>
                </View>
              </PressableScale>
            </View>
          </FadeIn>
        ))}

        <PressableScale onPress={addDay} accessibilityLabel="Agregar otro día" style={{ marginBottom: 20 }}>
          <View className="flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3.5">
            <Plus color={colors.soft} size={16} />
            <Text className="text-gray-300 text-sm font-semibold">Agregar otro día</Text>
          </View>
        </PressableScale>

        {error ? (
          <Text className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">{error}</Text>
        ) : null}

        <GradientButton
          title={saving ? 'Guardando...' : forFriend ? 'Enviar rutina a ' + friendName : 'Guardar rutina'}
          onPress={handleSave}
          loading={saving}
          colors={forFriend ? gradients.ocean : gradients.brand}
          icon={forFriend ? <Send color="#04120a" size={17} /> : <Check color="#04120a" size={18} strokeWidth={3} />}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
