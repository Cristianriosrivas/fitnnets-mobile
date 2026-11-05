import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, Image, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Sparkles, PlusCircle, ChevronDown, Dumbbell, Trash2, Repeat, Clock } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import FadeIn from '../../../components/ui/FadeIn'
import PressableScale from '../../../components/ui/PressableScale'
import IconBadge from '../../../components/ui/IconBadge'
import Skeleton from '../../../components/ui/Skeleton'
import GenerationProgress, { useGeneration } from '../../../components/ui/GenerationProgress'
import { TAB_BAR_SPACE } from '../../../components/ui/AnimatedTabBar'
import { postAi } from '../../../core/aiRequest'
import { GlowOrb } from '../../../components/ui/Aurora'
import { colors, gradients } from '../../../components/ui/theme'

// Esta pantalla replica la de la web en el celular (src/app/(main)/rutinas/page.tsx del repo fitnnets)
const FILTER_ACTIVE = '#00c950'
const ON_PRIMARY = '#052e14'
const imageUrl = (path: string) => `${process.env.EXPO_PUBLIC_API_URL}${path}`

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="px-4 py-1.5 rounded-full"
      style={active ? { backgroundColor: FILTER_ACTIVE, borderWidth: 1, borderColor: FILTER_ACTIVE } : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ fontSize: 12, fontWeight: '500', color: active ? ON_PRIMARY : colors.soft }}>{label}</Text>
    </Pressable>
  )
}

function RoutineStat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      {icon}
      <Text className="text-xs" style={{ color: colors.soft }}>{label}</Text>
    </View>
  )
}

type RoutineCardProps = {
  routine: any
  highlighted: boolean
  expanded: boolean
  onToggle: () => void
  onStart: () => void
  onDelete: () => void
}

function RoutineCard({ routine, highlighted, expanded, onToggle, onStart, onDelete }: RoutineCardProps) {
  const totalExercises = routine.routine_days?.reduce((sum: number, d: any) => sum + (d.routine_exercises?.length || 0), 0)
  const firstExercise = routine.routine_days?.[0]?.routine_exercises?.[0]
  const thumbnail = firstExercise?.exercises?.gif_url

  return (
    <View
      className="bg-surface rounded-2xl p-4 mb-4"
      style={{ borderWidth: 1, borderColor: highlighted ? 'rgba(34, 197, 94, 0.5)' : colors.border }}
    >
      <View className="w-full rounded-xl overflow-hidden bg-surface2 items-center justify-center mb-4" style={{ height: 128 }}>
        {thumbnail ? (
          <Image source={{ uri: imageUrl(thumbnail) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        ) : (
          <Dumbbell color={colors.border} size={28} />
        )}
      </View>

      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-white font-bold text-base">{routine.title}</Text>
          <Text className="text-xs capitalize" style={{ color: colors.soft }}>
            {routine.generated_by_ai ? routine.goal?.replace('_', ' ') : 'Rutina personalizada'}
          </Text>
          {routine.created_by ? (
            <View className="self-start rounded-md px-2 py-0.5 mt-1.5" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <Text className="text-[11px] font-medium" style={{ color: '#93c5fd' }}>
                {'Rutina creada por ' + (routine.creator?.username || 'un amigo')}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2">
          <PressableScale onPress={onStart} accessibilityLabel={'Iniciar ' + routine.title}>
            <View
              className="px-3.5 py-2 rounded-lg"
              style={highlighted ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-xs font-semibold" style={{ color: highlighted ? ON_PRIMARY : '#f5f7f6' }}>Iniciar rutina</Text>
            </View>
          </PressableScale>
          <Pressable onPress={onDelete} accessibilityLabel={'Borrar ' + routine.title} hitSlop={8} className="p-2">
            <Trash2 color={colors.muted} size={16} />
          </Pressable>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center mt-3" style={{ columnGap: 16, rowGap: 4 }}>
        <RoutineStat icon={<Dumbbell color={colors.soft} size={13} />} label={(routine.routine_days?.length || 0) + ' días'} />
        {firstExercise?.sets ? <RoutineStat icon={<Repeat color={colors.soft} size={13} />} label={firstExercise.sets + ' series'} /> : null}
        {firstExercise?.rest_seconds ? <RoutineStat icon={<Clock color={colors.soft} size={13} />} label={firstExercise.rest_seconds + ' seg descanso'} /> : null}
      </View>

      <Pressable onPress={onToggle} hitSlop={8} className="flex-row items-center gap-1 mt-3 self-start">
        <Text className="text-primary text-xs font-medium">
          {expanded ? 'Ocultar detalles' : `Ver detalles (${totalExercises} ejercicios)`}
        </Text>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDown color={colors.primary} size={14} />
        </View>
      </Pressable>

      {expanded ? (
        <View className="mt-4 pt-4 gap-5" style={{ borderTopWidth: 1, borderTopColor: '#1f2926' }}>
          {[...(routine.routine_days || [])]
            .sort((a: any, b: any) => a.day_number - b.day_number)
            .map((day: any) => (
              <View key={day.id}>
                <Text className="text-white font-semibold text-sm mb-2.5">{day.title}</Text>
                <View className="gap-2">
                  {day.routine_exercises?.map((ex: any) => (
                    <View key={ex.id} className="flex-row items-center gap-3 rounded-lg p-2" style={{ backgroundColor: colors.surface }}>
                      {ex.exercises?.gif_url ? (
                        <Image source={{ uri: imageUrl(ex.exercises.gif_url) }} resizeMode="cover" className="rounded-lg bg-surface2" style={{ width: 44, height: 44 }} />
                      ) : (
                        <View className="rounded-lg bg-surface2" style={{ width: 44, height: 44 }} />
                      )}
                      <View className="flex-1">
                        <Text className="text-white text-sm" numberOfLines={1}>{ex.exercises?.name}</Text>
                        <Text className="text-xs" style={{ color: colors.muted }}>{ex.sets} series x {ex.reps} reps</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  )
}

export default function RutinasScreen() {
  const router = useRouter()
  const [routines, setRoutines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const generation = useGeneration('routine')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('todas')
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

  const handleGenerate = () =>
    generation.run(async () => {
      setError('')
      const { data: { session } } = await supabase.auth.getSession()
      const result = await postAi(`${process.env.EXPO_PUBLIC_API_URL}/api/generate-routine`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!result.ok) {
        setError(result.message)
        return false
      }
      await loadRoutines()
      return true
    })

  const handleDelete = (routineId: string) => {
    Alert.alert('Borrar rutina', '¿Seguro que quieres borrarla? Esta acción no se puede deshacer.', [
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

  const hasFriendRoutines = routines.some((r) => r.created_by)

  const dayFilters = useMemo(() => {
    const counts = new Set<number>(routines.filter((r) => r.generated_by_ai).map((r) => r.routine_days?.length || 0))
    return Array.from(counts).filter(Boolean).sort((a, b) => a - b)
  }, [routines])

  const filteredRoutines = routines.filter((r) => {
    if (filter === 'todas') return true
    if (filter === 'personalizada') return !r.generated_by_ai && !r.created_by
    if (filter === 'amigos') return !!r.created_by
    return (r.routine_days?.length || 0) === parseInt(filter, 10)
  })

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <GlowOrb color={colors.primary} size={340} style={{ top: -170, right: -130 }} intensity={0.2} />

      <FadeIn>
        <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
          Entrenamiento
        </Text>
        <Text className="text-white text-3xl font-extrabold mt-1 mb-3">Tus Rutinas</Text>
      </FadeIn>

      <FadeIn delay={80}>
        <PressableScale onPress={handleGenerate} disabled={generation.active} accessibilityLabel="Generar rutina con IA">
          <View className="flex-row items-center justify-center gap-2 rounded-xl py-3 bg-primary" style={{ opacity: generation.active ? 0.5 : 1 }}>
            {generation.active ? <ActivityIndicator color={ON_PRIMARY} size="small" /> : <Sparkles color={ON_PRIMARY} size={16} />}
            <Text className="text-sm font-semibold" style={{ color: ON_PRIMARY }}>
              {generation.active ? 'Generando...' : 'Generar con IA'}
            </Text>
          </View>
        </PressableScale>

        <PressableScale onPress={() => router.push('/(main)/rutinas-nueva')} style={{ marginTop: 8, marginBottom: 24 }}>
          <View className="flex-row items-center justify-center gap-2 rounded-xl py-3 bg-surface2 border border-border">
            <PlusCircle color="#f5f7f6" size={16} />
            <Text className="text-sm" style={{ color: '#f5f7f6' }}>Crear rutina personalizada</Text>
          </View>
        </PressableScale>
      </FadeIn>

      <GenerationProgress generation={generation} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 24 }} contentContainerStyle={{ gap: 8 }}>
        <FilterChip label="Todas" active={filter === 'todas'} onPress={() => setFilter('todas')} />
        {dayFilters.map((d) => (
          <FilterChip key={d} label={d + ' Días'} active={filter === String(d)} onPress={() => setFilter(String(d))} />
        ))}
        <FilterChip label="Personalizada" active={filter === 'personalizada'} onPress={() => setFilter('personalizada')} />
        {hasFriendRoutines ? <FilterChip label="De amigos" active={filter === 'amigos'} onPress={() => setFilter('amigos')} /> : null}
      </ScrollView>

      {error ? (
        <Text className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</Text>
      ) : null}

      {loading ? (
        <>
          <Skeleton height={280} radius={16} style={{ marginBottom: 16 }} />
          <Skeleton height={280} radius={16} style={{ marginBottom: 16 }} />
        </>
      ) : routines.length === 0 ? (
        <FadeIn delay={160}>
          <View className="bg-surface border border-border rounded-2xl p-8 items-center">
            <IconBadge colors={gradients.violet} size={60} radius={20}>
              <Dumbbell color="#ffffff" size={28} />
            </IconBadge>
            <Text className="text-white font-bold text-base mt-4">Aún no tienes rutinas</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Pídele una a la IA o arma la tuya ejercicio por ejercicio.
            </Text>
          </View>
        </FadeIn>
      ) : filteredRoutines.length === 0 ? (
        <View className="bg-surface border border-border rounded-2xl items-center" style={{ paddingVertical: 64 }}>
          <Text style={{ color: colors.soft }}>No hay rutinas en esta categoría.</Text>
        </View>
      ) : (
        filteredRoutines.map((routine, index) => (
          <FadeIn key={routine.id} delay={140 + Math.min(index, 6) * 70}>
            <RoutineCard
              routine={routine}
              highlighted={index === 0}
              expanded={expandedId === routine.id}
              onToggle={() => setExpandedId(expandedId === routine.id ? null : routine.id)}
              onStart={() => router.push(`/(main)/entrenar/${routine.id}`)}
              onDelete={() => handleDelete(routine.id)}
            />
          </FadeIn>
        ))
      )}
    </ScrollView>
  )
}
