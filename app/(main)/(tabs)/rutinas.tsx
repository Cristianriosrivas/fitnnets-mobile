import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, Image, Alert } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Sparkles, Play, PlusCircle, ChevronDown, Dumbbell, Trash2, Users } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import FadeIn from '../../../components/ui/FadeIn'
import PressableScale from '../../../components/ui/PressableScale'
import GradientButton from '../../../components/ui/GradientButton'
import IconBadge from '../../../components/ui/IconBadge'
import Skeleton from '../../../components/ui/Skeleton'
import { GlowOrb } from '../../../components/ui/Aurora'
import { colors, glow, gradients } from '../../../components/ui/theme'

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

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <GlowOrb color={colors.violet} size={340} style={{ top: -170, right: -130 }} intensity={0.22} />

      <FadeIn>
        <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
          Entrena con propósito
        </Text>
        <Text className="text-white text-3xl font-extrabold mt-1 mb-5">Tus rutinas</Text>
      </FadeIn>

      <FadeIn delay={80}>
        <GradientButton
          title={generating ? 'La IA está creando tu rutina...' : 'Generar rutina con IA'}
          onPress={handleGenerate}
          loading={generating}
          icon={<Sparkles color="#04120a" size={17} />}
        />
        {generating ? (
          <Text className="text-gray-500 text-xs text-center mt-2">Puede tardar hasta un minuto. No cierres la app.</Text>
        ) : null}

        <PressableScale onPress={() => router.push('/(main)/rutinas-nueva')} style={{ marginTop: 12, marginBottom: 20 }}>
          <View className="bg-surface2 border border-border rounded-2xl items-center flex-row justify-center gap-2" style={{ minHeight: 52 }}>
            <PlusCircle color={colors.soft} size={17} />
            <Text className="text-white font-semibold">Crear rutina personalizada</Text>
          </View>
        </PressableScale>
      </FadeIn>

      {error ? (
        <Text className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">{error}</Text>
      ) : null}

      {loading ? (
        <>
          <Skeleton height={120} radius={24} style={{ marginBottom: 14 }} />
          <Skeleton height={120} radius={24} style={{ marginBottom: 14 }} />
        </>
      ) : routines.length === 0 ? (
        <FadeIn delay={160}>
          <View className="bg-surface border border-border rounded-3xl p-8 items-center">
            <IconBadge colors={gradients.violet} size={60} radius={20}>
              <Dumbbell color="#ffffff" size={28} />
            </IconBadge>
            <Text className="text-white font-bold text-base mt-4">Aún no tienes rutinas</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Pídele una a la IA o arma la tuya ejercicio por ejercicio.
            </Text>
          </View>
        </FadeIn>
      ) : (
        routines.map((routine, index) => {
          const isExpanded = expandedId === routine.id
          const totalExercises = routine.routine_days?.reduce(
            (sum: number, d: any) => sum + (d.routine_exercises?.length || 0),
            0
          )
          const assigned = !!routine.created_by
          const badgeColors = assigned ? gradients.ocean : routine.generated_by_ai ? gradients.violet : gradients.brand

          return (
            <FadeIn key={routine.id} delay={140 + Math.min(index, 6) * 70}>
              <View className="bg-surface border border-border rounded-3xl p-4 mb-4">
                <View className="flex-row items-center gap-3">
                  <IconBadge colors={badgeColors} size={46} radius={15}>
                    {assigned ? (
                      <Users color="#04120a" size={20} />
                    ) : routine.generated_by_ai ? (
                      <Sparkles color="#ffffff" size={20} />
                    ) : (
                      <Dumbbell color="#04120a" size={20} />
                    )}
                  </IconBadge>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-base" numberOfLines={2}>
                      {routine.title}
                    </Text>
                    <Text className="text-gray-400 text-xs capitalize mt-0.5">
                      {routine.generated_by_ai ? 'IA · ' + (routine.goal?.replace('_', ' ') || '') : 'Rutina personalizada'}
                    </Text>
                  </View>
                  <PressableScale
                    onPress={() => router.push(`/(main)/entrenar/${routine.id}`)}
                    accessibilityLabel={'Iniciar ' + routine.title}
                  >
                    <View className="bg-primary rounded-full w-11 h-11 items-center justify-center" style={glow(colors.primary, 12, 0.5)}>
                      <Play color="#04120a" size={16} fill="#04120a" />
                    </View>
                  </PressableScale>
                </View>

                {assigned ? (
                  <View className="self-start bg-sky-500/10 border border-sky-500/25 rounded-full px-2.5 py-1 mt-3">
                    <Text className="text-sky-300 text-[11px] font-semibold">
                      {'Rutina creada por ' + (routine.creator?.username || 'un amigo')}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                  <Pressable
                    onPress={() => setExpandedId(isExpanded ? null : routine.id)}
                    className="flex-row items-center gap-1 py-1"
                  >
                    <Text className="text-primary text-xs font-semibold">
                      {isExpanded ? 'Ocultar detalles' : `Ver detalles (${totalExercises} ejercicios)`}
                    </Text>
                    <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                      <ChevronDown color={colors.primary} size={14} />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(routine.id)}
                    accessibilityLabel={'Borrar ' + routine.title}
                    hitSlop={10}
                    className="p-1.5"
                  >
                    <Trash2 color={colors.muted} size={17} />
                  </Pressable>
                </View>

                {isExpanded && (
                  <FadeIn distance={8}>
                    <View className="mt-3 gap-4">
                      {routine.routine_days
                        ?.sort((a: any, b: any) => a.day_number - b.day_number)
                        .map((day: any) => (
                          <View key={day.id}>
                            <Text className="text-white font-semibold text-sm mb-2">{day.title}</Text>
                            {day.routine_exercises?.map((ex: any) => (
                              <View key={ex.id} className="flex-row items-center gap-3 bg-surface2 rounded-2xl p-2 mb-2">
                                {ex.exercises?.gif_url ? (
                                  <Image
                                    source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${ex.exercises.gif_url}` }}
                                    className="w-12 h-12 rounded-xl bg-border"
                                  />
                                ) : (
                                  <View className="w-12 h-12 rounded-xl bg-border items-center justify-center">
                                    <Dumbbell color={colors.muted} size={18} />
                                  </View>
                                )}
                                <View className="flex-1">
                                  <Text className="text-white text-sm font-medium">{ex.exercises?.name}</Text>
                                  <Text className="text-gray-500 text-xs mt-0.5">
                                    {ex.sets} series × {ex.reps} reps
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ))}
                    </View>
                  </FadeIn>
                )}
              </View>
            </FadeIn>
          )
        })
      )}
    </ScrollView>
  )
}
