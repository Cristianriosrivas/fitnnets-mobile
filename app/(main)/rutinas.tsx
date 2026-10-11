import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, Image, Alert } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Sparkles, Play, PlusCircle, ChevronDown, Dumbbell, Trash2 } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

export default function RutinasScreen() {
  const router = useRouter()
  const [routines, setRoutines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadRoutines = useCallback(async () => {
    const { data } = await supabase
      .from('routines')
      .select('id, title, goal, generated_by_ai, created_at, created_by, creator:profiles!routines_created_by_fkey(username), routine_days(id, day_number, title, routine_exercises(id, sets, reps, rest_seconds, exercises(name, gif_url)))')
      .order('created_at', { ascending: false })

    setRoutines(data || [])
    setLoading(false)
  }, [])

  // Recarga al entrar a la pestana: asi aparecen las rutinas que te asignen tus amigos
  useFocusEffect(
    useCallback(() => {
      loadRoutines()
    }, [loadRoutines])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await loadRoutines()
    setRefreshing(false)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/generate-routine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al generar la rutina')
        setGenerating(false)
        return
      }

      await loadRoutines()
    } catch (e) {
      setError('No se pudo conectar con el servidor')
    }
    setGenerating(false)
  }

  const handleDelete = (routineId: string) => {
    Alert.alert('Borrar rutina', 'Seguro que quieres borrarla? Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          // .select('id') devuelve las filas borradas: si viene vacio, la base de datos
          // rechazo el borrado en silencio (falta la politica de RLS de borrado)
          const { data, error: deleteError } = await supabase
            .from('routines')
            .delete()
            .eq('id', routineId)
            .select('id')

          if (deleteError || !data || data.length === 0) {
            Alert.alert('No se pudo borrar', deleteError?.message || 'Revisa la politica de borrado en Supabase.')
            return
          }
          await loadRoutines()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Cargando...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
    >
      <Text className="text-white text-2xl font-bold mb-4">Tus Rutinas</Text>

      <Pressable
        onPress={handleGenerate}
        disabled={generating}
        className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2 mb-3"
      >
        <Sparkles color="black" size={16} />
        <Text className="text-black font-semibold">
          {generating ? 'Generando...' : 'Generar rutina con IA'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(main)/rutinas-nueva')}
        className="bg-surface2 border border-border rounded-xl py-3 items-center flex-row justify-center gap-2 mb-5"
      >
        <PlusCircle color="#9ca8a5" size={16} />
        <Text className="text-white font-semibold">Crear rutina personalizada</Text>
      </Pressable>

      {error ? (
        <Text className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-4">{error}</Text>
      ) : null}

      {routines.length === 0 ? (
        <View className="bg-surface border border-border rounded-2xl p-8 items-center">
          <Text className="text-gray-400 text-center">Aún no tienes rutinas.</Text>
        </View>
      ) : (
        routines.map((routine) => {
          const isExpanded = expandedId === routine.id
          const totalExercises = routine.routine_days?.reduce(
            (sum: number, d: any) => sum + (d.routine_exercises?.length || 0),
            0
          )

          return (
            <View key={routine.id} className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-white font-bold">{routine.title}</Text>
                  <Text className="text-gray-400 text-xs capitalize mt-0.5">
                    {routine.generated_by_ai ? routine.goal?.replace('_', ' ') : 'Rutina personalizada'}
                  </Text>
                  {routine.created_by ? (
                    <View className="self-start bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-0.5 mt-1.5">
                      <Text className="text-blue-300 text-[11px] font-medium">
                        {'Rutina creada por ' + (routine.creator?.username || 'un amigo')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => router.push(`/(main)/entrenar/${routine.id}`)}
                    className="bg-primary rounded-lg px-3 py-2 flex-row items-center gap-1.5"
                  >
                    <Play color="black" size={14} />
                    <Text className="text-black text-xs font-semibold">Iniciar</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(routine.id)} className="p-1.5">
                    <Trash2 color="#6b7876" size={16} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : routine.id)}
                className="flex-row items-center gap-1 mt-3"
              >
                <Text className="text-primary text-xs font-medium">
                  {isExpanded ? 'Ocultar detalles' : `Ver detalles (${totalExercises} ejercicios)`}
                </Text>
                <ChevronDown color="#22c55e" size={14} />
              </Pressable>

              {isExpanded && (
                <View className="mt-3 pt-3 border-t border-border gap-4">
                  {routine.routine_days
                    ?.sort((a: any, b: any) => a.day_number - b.day_number)
                    .map((day: any) => (
                      <View key={day.id}>
                        <Text className="text-white font-semibold text-sm mb-2">{day.title}</Text>
                        {day.routine_exercises?.map((ex: any) => (
                          <View key={ex.id} className="flex-row items-center gap-3 bg-surface2 rounded-lg p-2 mb-2">
                            {ex.exercises?.gif_url ? (
                              <Image
                                source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${ex.exercises.gif_url}` }}
                                className="w-11 h-11 rounded-lg bg-border"
                              />
                            ) : (
                              <View className="w-11 h-11 rounded-lg bg-border items-center justify-center">
                                <Dumbbell color="#2a3532" size={18} />
                              </View>
                            )}
                            <View>
                              <Text className="text-white text-sm">{ex.exercises?.name}</Text>
                              <Text className="text-gray-500 text-xs">
                                {ex.sets} series x {ex.reps} reps
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}