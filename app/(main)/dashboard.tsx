import { useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import { Weight, Ruler, Dumbbell, Flame, Play, Droplet } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

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
const RING_RADIUS = 42
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

// La altura debe guardarse en cm (ej: 181). Si algun dato viejo quedo en metros (ej: 1.81), se muestra bien igual.
function formatHeight(value: number | null) {
  if (!value) return '--'
  return value > 3 ? `${value} cm` : `${value} m`
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

  const weekPercent = Math.round((last7.filter((d) => d.trained).length / 7) * 100)
  const tipOfDay = TIPS[new Date().getDate() % TIPS.length]

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
      {/* Encabezado: el avatar abre el perfil */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-1 pr-3">
          <Text className="text-white text-2xl font-bold">¡Hola, {username || 'atleta'}! 👋</Text>
          <Text className="text-gray-400 text-sm mt-1">Tu progreso es el resultado de tus hábitos.</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(main)/perfil')}
          accessibilityLabel="Editar perfil"
          className="w-11 h-11 rounded-full bg-green-500/15 items-center justify-center"
        >
          <Text className="text-primary font-bold text-base">{username?.[0]?.toUpperCase() || 'U'}</Text>
        </Pressable>
      </View>

      {/* Estadisticas */}
      <View className="flex-row flex-wrap justify-between">
        <StatCard
          icon={<Weight color="#22c55e" size={14} />}
          label="Peso actual"
          value={weightKg ? `${weightKg} kg` : '-- kg'}
        />
        <StatCard
          icon={<Ruler color="#22c55e" size={14} />}
          label="Altura"
          value={formatHeight(heightCm)}
        />
        <StatCard
          icon={<Dumbbell color="#22c55e" size={14} />}
          label="Brazo"
          value={bicepCm ? `${bicepCm} cm` : '-- cm'}
        />
        <StatCard
          icon={<Flame color="#fb923c" size={14} />}
          label="Racha actual"
          value={`${streak} día${streak !== 1 ? 's' : ''}`}
        />
      </View>

      {/* Tu rutina de hoy */}
      <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
        <Text className="text-gray-400 text-xs mb-1">Tu rutina de hoy</Text>
        {latestRoutine ? (
          <>
            <Text className="text-white font-semibold text-base">{latestRoutine.dayTitle}</Text>
            <Text className="text-gray-400 text-xs mt-1">{latestRoutine.exerciseCount} ejercicios</Text>
            <Pressable
              onPress={() => router.push(`/(main)/entrenar/${latestRoutine.id}`)}
              className="bg-primary rounded-xl py-3 mt-4 flex-row items-center justify-center gap-2"
            >
              <Play color="black" size={16} />
              <Text className="text-black font-semibold">Iniciar rutina</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-white font-semibold text-base">Aún no tienes una rutina</Text>
            <Pressable
              onPress={() => router.push('/(main)/rutinas')}
              className="bg-primary rounded-xl py-3 mt-4 items-center"
            >
              <Text className="text-black font-semibold">Crear rutina</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Progreso semanal */}
      <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
        <Text className="text-white font-semibold text-sm mb-4">Progreso semanal</Text>
        <View className="flex-row items-center">
          <View style={{ width: 96, height: 96 }}>
            <Svg width={96} height={96} viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#1f2926" strokeWidth={10} />
              <Circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="#22c55e"
                strokeWidth={10}
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - weekPercent / 100)}
                strokeLinecap="round"
                rotation="-90"
                origin="50, 50"
              />
            </Svg>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="text-white text-lg font-bold">{weekPercent}%</Text>
              <Text style={{ fontSize: 9, color: '#9ca8a5' }}>Completado</Text>
            </View>
          </View>

          <View className="flex-1 flex-row items-end justify-between ml-6" style={{ height: 80 }}>
            {last7.map((d, i) => (
              <View key={i} className="items-center flex-1">
                <View style={{ height: 56, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 3 }}>
                  <View
                    style={{
                      height: d.trained ? 56 : 11,
                      borderRadius: 999,
                      backgroundColor: d.trained ? '#22c55e' : '#1f2926',
                    }}
                  />
                </View>
                <Text style={{ fontSize: 10, color: '#6b7876', marginTop: 6 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Consejo del dia */}
      <View className="bg-surface border border-border rounded-2xl p-5">
        <Text className="text-white font-semibold text-sm mb-3">Consejo del día</Text>
        <View className="flex-row items-start gap-3">
          <View className="bg-blue-500/15 rounded-lg p-2">
            <Droplet color="#60a5fa" size={18} />
          </View>
          <Text className="flex-1 text-gray-400 text-sm leading-5">{tipOfDay}</Text>
        </View>
      </View>
    </ScrollView>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="bg-surface border border-border rounded-2xl p-4 mb-3" style={{ width: '48.5%' }}>
      <View className="flex-row items-center gap-1.5 mb-1">
        {icon}
        <Text className="text-gray-400 text-xs">{label}</Text>
      </View>
      <Text className="text-white text-xl font-bold">{value}</Text>
    </View>
  )
}