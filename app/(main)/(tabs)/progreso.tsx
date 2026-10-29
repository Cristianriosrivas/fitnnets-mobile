import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl, Dimensions, ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { LineChart } from 'react-native-chart-kit'
import {
  Weight, Percent, Dumbbell, TrendingUp, TrendingDown, ArrowUp,
  Flame, Clock, Activity, Plus, Target, Check, PersonStanding, ChevronRight,
} from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import AnimatedRing from '../../../components/ui/AnimatedRing'
import CountUp from '../../../components/ui/CountUp'
import TiltCard from '../../../components/ui/TiltCard'
import FadeIn from '../../../components/ui/FadeIn'
import { GlowOrb } from '../../../components/ui/Aurora'
import IconBadge from '../../../components/ui/IconBadge'
import Skeleton from '../../../components/ui/Skeleton'
import PressableScale from '../../../components/ui/PressableScale'
import GradientFill from '../../../components/ui/GradientFill'
import { colors, gradients } from '../../../components/ui/theme'
import { checkNewBadges } from '../../../core/appChecks'
import { loadStrengthSeries, StrengthSeries } from '../../../core/training'
import { formatKg, strengthLevel } from '../../../core/gym'

const screenWidth = Dimensions.get('window').width
const TABS = ['Progreso', 'Métricas', 'Metas']
const GOAL_OPTIONS = [
  { value: 'perder_grasa', label: '🔥 Perder grasa' },
  { value: 'ganar_musculo', label: '💪 Ganar músculo' },
  { value: 'mantenimiento', label: '⚖️ Mantenimiento' },
  { value: 'resistencia', label: '🏃 Mejorar resistencia' },
]

export default function ProgresoScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Progreso')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [profileWeight, setProfileWeight] = useState<number | null>(null)
  const [weightData, setWeightData] = useState<{ date: string; peso: number }[]>([])
  const [weightChange, setWeightChange] = useState<number | null>(null)
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [weekTrainedDays, setWeekTrainedDays] = useState(0)
  const [selectedPoint, setSelectedPoint] = useState<{ date: string; peso: number } | null>(null)

  const [showWeightModal, setShowWeightModal] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightError, setWeightError] = useState('')

  const [goal, setGoal] = useState('')
  const [customGoalNotes, setCustomGoalNotes] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [goalError, setGoalError] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('weight_kg, goal, custom_goal_notes')
      .eq('id', user.id)
      .single()

    setProfileWeight(profile?.weight_kg || null)
    setGoal(profile?.goal || '')
    setCustomGoalNotes(profile?.custom_goal_notes || '')

    const { data: metrics } = await supabase
      .from('body_metrics')
      .select('date, weight_kg')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    const withWeight = (metrics || []).filter((m) => m.weight_kg)
    const formatted = withWeight.map((m) => ({
      date: new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      peso: Number(m.weight_kg),
    }))
    setWeightData(formatted)
    setSelectedPoint(formatted.length > 0 ? formatted[formatted.length - 1] : null)
    setWeightChange(formatted.length >= 2 ? formatted[formatted.length - 1].peso - formatted[0].peso : null)

    const { data: logs } = await supabase.from('progress_logs').select('date').eq('user_id', user.id)
    setTotalWorkouts(logs?.length || 0)

    const uniqueDates = new Set((logs || []).map((l) => l.date))
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (uniqueDates.has(d.toISOString().split('T')[0])) count++
    }
    setWeekTrainedDays(count)

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

  const handleSaveWeight = async () => {
    const value = parseFloat(newWeight.replace(',', '.'))
    if (!value || value <= 0) {
      setWeightError('Escribe un peso valido')
      return
    }
    setSavingWeight(true)
    setWeightError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingWeight(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('body_metrics')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      // .select('id') devuelve las filas actualizadas: si viene vacio, la base de datos
      // rechazo el cambio en silencio (falta la politica UPDATE de body_metrics)
      const { data: updated, error: updateError } = await supabase
        .from('body_metrics')
        .update({ weight_kg: value })
        .eq('id', existing.id)
        .select('id')

      if (updateError || !updated || updated.length === 0) {
        setWeightError(updateError?.message || 'No se pudo actualizar el registro de hoy. Revisa la politica UPDATE de body_metrics en Supabase.')
        setSavingWeight(false)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('body_metrics')
        .insert({ user_id: user.id, date: today, weight_kg: value })

      if (insertError) {
        setWeightError(insertError.message)
        setSavingWeight(false)
        return
      }
    }

    // Mantener sincronizado el peso "actual" del perfil (usado en el dashboard)
    await supabase.from('profiles').update({ weight_kg: value }).eq('id', user.id)

    setNewWeight('')
    setShowWeightModal(false)
    setSavingWeight(false)
    await loadData()
    checkNewBadges()
  }

  const handleSaveGoal = async () => {
    setSavingGoal(true)
    setGoalSaved(false)
    setGoalError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingGoal(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ goal, custom_goal_notes: customGoalNotes || null })
      .eq('id', user.id)

    setSavingGoal(false)
    if (updateError) {
      setGoalError(updateError.message)
      return
    }
    setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 2500)
  }

  const weekPercent = Math.round((weekTrainedDays / 7) * 100)
  const currentWeight = weightData.length > 0 ? weightData[weightData.length - 1].peso : profileWeight
  const estimatedMinutes = totalWorkouts * 15
  const estimatedCalories = totalWorkouts * 35

  // Etiquetas del eje X: se muestran espaciadas y siempre incluyen la ultima fecha
  const labelStep = Math.max(1, Math.ceil(weightData.length / 4))
  const chartLabels = weightData.map((d, i) => ((weightData.length - 1 - i) % labelStep === 0 ? d.date : ''))
  const weightValues = weightData.map((d) => d.peso)
  const weightRange = weightValues.length > 0 ? Math.max(...weightValues) - Math.min(...weightValues) : 0

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
    >
      <GlowOrb color={colors.teal} size={340} style={{ top: -170, left: -120 }} intensity={0.24} />
      <FadeIn>
        <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
          Tu evolución
        </Text>
        <Text className="text-white text-3xl font-extrabold mt-1">Tu progreso</Text>
        <Text className="text-gray-400 text-sm mt-1 mb-4">Los resultados se construyen con información.</Text>
      </FadeIn>

      {activeTab === 'Progreso' && (
        <Pressable
          onPress={() => setShowWeightModal(true)}
          className="bg-primary rounded-xl px-4 py-3 flex-row items-center gap-2 self-start mb-4"
        >
          <Plus color="black" size={16} />
          <Text className="text-black font-semibold text-sm">Registrar peso de hoy</Text>
        </Pressable>
      )}

      {/* Mapa muscular 3D */}
      <PressableScale onPress={() => router.push('/(main)/cuerpo')} accessibilityLabel="Abrir mi mapa muscular" style={{ marginBottom: 16 }}>
        <View className="rounded-3xl overflow-hidden p-4 flex-row items-center gap-4" style={{ borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' }}>
          <GradientFill colors={['#1e1b4b', '#141b19']} direction="horizontal" />
          <IconBadge colors={gradients.violet} size={46} radius={15}>
            <PersonStanding color="#ffffff" size={22} />
          </IconBadge>
          <View className="flex-1">
            <Text className="text-white font-extrabold text-base">Tu mapa muscular 3D</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Qué entrenas más, dónde progresas y tu rango por músculo</Text>
          </View>
          <ChevronRight color={colors.violet} size={18} />
        </View>
      </PressableScale>

      {/* Pestañas */}
      <View className="flex-row gap-2 mb-5">
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full border ${
              activeTab === tab ? 'bg-primary border-primary' : 'bg-surface border-border'
            }`}
          >
            <Text className={`text-xs font-medium ${activeTab === tab ? 'text-black' : 'text-gray-400'}`}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {/* Registrar peso */}
      {showWeightModal && (
        <View className="bg-surface border border-border rounded-2xl p-4 mb-5">
          <Text className="text-white font-semibold text-sm mb-2">¿Cuánto pesas hoy?</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newWeight}
              onChangeText={setNewWeight}
              keyboardType="decimal-pad"
              placeholder="ej: 74.5"
              placeholderTextColor="#6b7876"
              autoFocus
              className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-white"
            />
            <Pressable
              onPress={handleSaveWeight}
              disabled={savingWeight}
              className="bg-primary rounded-lg px-4 items-center justify-center"
              style={{ opacity: savingWeight ? 0.5 : 1 }}
            >
              <Text className="text-black font-semibold text-sm">{savingWeight ? '...' : 'Guardar'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowWeightModal(false)
                setWeightError('')
              }}
              className="bg-surface2 border border-border rounded-lg px-3 items-center justify-center"
            >
              <Text className="text-gray-300 text-sm">Cancelar</Text>
            </Pressable>
          </View>
          {weightError ? <Text className="text-red-400 text-xs mt-2">{weightError}</Text> : null}
          <Text className="text-gray-500 text-xs mt-2">
            Esto actualiza tu peso actual y se refleja en la gráfica de evolución.
          </Text>
        </View>
      )}

      {/* ===== Pestaña Progreso ===== */}
      {activeTab === 'Progreso' && (
        <>
          <View className="flex-row flex-wrap justify-between">
            <StatCard icon={<Weight color="#22c55e" size={14} />} label="Peso" value={`${currentWeight ?? '--'} kg`}>
              {weightChange !== null && (
                <View className="flex-row items-center gap-1 mt-1">
                  {weightChange < 0 ? (
                    <TrendingDown color="#22c55e" size={12} />
                  ) : (
                    <TrendingUp color="#fb923c" size={12} />
                  )}
                  <Text className={weightChange < 0 ? 'text-primary text-xs' : 'text-orange-400 text-xs'}>
                    {weightChange > 0 ? '+' : ''}
                    {weightChange.toFixed(1)} kg
                  </Text>
                </View>
              )}
            </StatCard>

            <StatCard icon={<Percent color="#60a5fa" size={14} />} label="% Grasa corporal" value="--">
              <Text className="text-gray-500 text-xs mt-1">Sin datos aún</Text>
            </StatCard>

            <StatCard icon={<Dumbbell color="#c084fc" size={14} />} label="Masa muscular" value="--">
              <Text className="text-gray-500 text-xs mt-1">Sin datos aún</Text>
            </StatCard>

            <StatCard
              icon={<Activity color="#22c55e" size={14} />}
              label="Fuerza"
              value={totalWorkouts > 0 ? `+${Math.min(totalWorkouts * 2, 40)}%` : '--'}
            >
              {totalWorkouts > 0 && (
                <View className="flex-row items-center gap-1 mt-1">
                  <ArrowUp color="#22c55e" size={12} />
                  <Text className="text-primary text-xs flex-1">Basado en tu actividad</Text>
                </View>
              )}
            </StatCard>
          </View>

          {/* Evolución de peso */}
          <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <Text className="text-white font-semibold text-sm mb-3">Evolución de peso</Text>

            {weightData.length === 0 ? (
              <View className="items-center justify-center py-10 gap-2">
                <Text className="text-gray-500 text-sm text-center">Aún no tienes registros históricos de peso.</Text>
                <Pressable onPress={() => setShowWeightModal(true)}>
                  <Text className="text-primary text-xs">Registra tu peso de hoy para empezar tu gráfica</Text>
                </Pressable>
              </View>
            ) : weightData.length === 1 ? (
              <Text className="text-gray-500 text-sm text-center py-8">
                Registra tu peso al menos 2 veces para ver tu evolución.
              </Text>
            ) : (
              <>
                {selectedPoint && (
                  <View className="self-end bg-surface2 border border-border rounded-lg px-3 py-2 mb-2">
                    <Text className="text-gray-400 text-xs">{selectedPoint.date}</Text>
                    <Text className="text-primary text-sm font-semibold">peso : {selectedPoint.peso}</Text>
                  </View>
                )}
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [{ data: weightValues }],
                  }}
                  width={screenWidth - 72}
                  height={200}
                  withVerticalLines={false}
                  withOuterLines={false}
                  bezier
                  onDataPointClick={({ index }) => setSelectedPoint(weightData[index])}
                  chartConfig={{
                    backgroundColor: '#141b19',
                    backgroundGradientFrom: '#141b19',
                    backgroundGradientTo: '#141b19',
                    decimalPlaces: weightRange < 4 ? 1 : 0,
                    color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(107, 120, 118, ${opacity})`,
                    fillShadowGradientFrom: '#22c55e',
                    fillShadowGradientFromOpacity: 0.35,
                    fillShadowGradientTo: '#22c55e',
                    fillShadowGradientToOpacity: 0,
                    propsForDots: { r: '3', strokeWidth: '0', fill: '#22c55e' },
                    propsForBackgroundLines: { stroke: '#1f2926', strokeDasharray: '3 3' },
                  }}
                  style={{ marginLeft: -12, borderRadius: 12 }}
                />
                <Text className="text-gray-600 text-[10px] text-center mt-1">Toca un punto para ver el detalle</Text>
              </>
            )}
          </View>

          {/* Progreso semanal */}
          <View className="bg-surface border border-border rounded-2xl p-5">
            <Text className="text-white font-semibold text-sm mb-4">Progreso semanal</Text>
            <View className="flex-row items-center">
              <ProgressRing percent={weekPercent} caption="Esta semana" />

              <View className="flex-1 ml-5 gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <Dumbbell color="#9ca8a5" size={13} />
                    <Text className="text-gray-400 text-sm flex-1">Días esta semana</Text>
                  </View>
                  <Text className="text-white font-semibold text-sm">{weekTrainedDays}/7</Text>
                </View>

                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <Clock color="#9ca8a5" size={13} />
                    <Text className="text-gray-400 text-sm flex-1">Tiempo total (histórico)</Text>
                  </View>
                  <Text className="text-white font-semibold text-sm">
                    {Math.floor(estimatedMinutes / 60)}h {estimatedMinutes % 60}m
                  </Text>
                </View>

                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <Flame color="#9ca8a5" size={13} />
                    <Text className="text-gray-400 text-sm flex-1">Calorías aprox. (histórico)</Text>
                  </View>
                  <Text className="text-white font-semibold text-sm">{estimatedCalories.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </View>
        </>
      )}

      {/* ===== Pestaña Métricas ===== */}
      {activeTab === 'Métricas' && <StrengthSection />}

      {/* ===== Pestaña Metas ===== */}
      {activeTab === 'Metas' && (
        <View className="bg-surface border border-border rounded-2xl p-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Target color="#22c55e" size={18} />
            <Text className="text-white font-semibold text-sm">Define tu meta</Text>
          </View>

          <Text className="text-gray-400 text-sm mb-2">Categoría principal</Text>
          <View className="gap-2 mb-4">
            {GOAL_OPTIONS.map((g) => {
              const selected = goal === g.value
              return (
                <Pressable
                  key={g.value}
                  onPress={() => setGoal(g.value)}
                  className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                    selected ? 'border-primary bg-green-500/10' : 'border-border bg-surface2'
                  }`}
                >
                  <Text className={selected ? 'text-white font-medium' : 'text-gray-300'}>{g.label}</Text>
                  {selected && <Check color="#22c55e" size={16} />}
                </Pressable>
              )
            })}
          </View>

          <Text className="text-gray-400 text-sm mb-2">Cuéntanos con tus palabras qué quieres lograr</Text>
          <TextInput
            value={customGoalNotes}
            onChangeText={setCustomGoalNotes}
            multiline
            placeholder="Ej: quiero bajar de peso sobre todo en el abdomen, tengo una boda en 3 meses y quiero verme y sentirme mejor..."
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white"
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />
          <Text className="text-gray-500 text-xs mt-2">
            Esta nota se usará automáticamente la próxima vez que generes una rutina o un plan de nutrición con IA.
          </Text>

          {goalError ? <Text className="text-red-400 text-xs mt-2">{goalError}</Text> : null}

          <Pressable
            onPress={handleSaveGoal}
            disabled={savingGoal || !goal}
            className="bg-primary rounded-lg py-3 items-center mt-4"
            style={{ opacity: savingGoal || !goal ? 0.5 : 1 }}
          >
            <Text className="text-black font-semibold text-sm">
              {savingGoal ? 'Guardando...' : goalSaved ? '✓ Guardado' : 'Guardar mi meta'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

function StatCard({
  icon, label, value, children,
}: {
  icon: React.ReactNode
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <View style={{ width: '48.5%', marginBottom: 12 }}>
      <TiltCard maxTilt={12} radius={22}>
        <View className="bg-surface border border-border rounded-[22px] p-4">
          <View className="flex-row items-center gap-1.5 mb-2">
            {icon}
            <Text className="text-gray-400 text-xs flex-1">{label}</Text>
          </View>
          <Text className="text-white text-2xl font-extrabold">{value}</Text>
          {children}
        </View>
      </TiltCard>
    </View>
  )
}

function ProgressRing({ percent, caption }: { percent: number; caption: string }) {
  return (
    <AnimatedRing progress={percent} size={100} stroke={11} delay={200}>
      <CountUp value={percent} suffix="%" delay={200} className="text-white text-lg font-extrabold" />
      <Text style={{ fontSize: 9, color: colors.soft, textAlign: 'center', lineHeight: 11 }}>{caption}</Text>
    </AnimatedRing>
  )
}

// Evolución del peso levantado por ejercicio (datos de progress_logs.weight_used_kg)
function StrengthSection() {
  const [series, setSeries] = useState<StrengthSeries[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [body, setBody] = useState<{ weightKg: number | null; gender: string | null }>({ weightKg: null, gender: null })

  const load = useCallback(async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const [data, { data: p }] = await Promise.all([
        loadStrengthSeries(user.id),
        supabase.from('profiles').select('weight_kg, gender').eq('id', user.id).single(),
      ])
      setBody({ weightKg: p?.weight_kg ? Number(p.weight_kg) : null, gender: p?.gender ?? null })
      setSeries(data)
      setSelectedId((current) => current ?? data[0]?.exerciseId ?? null)
    } catch {
      setError('No pudimos cargar tu fuerza por ejercicio.')
      setSeries([])
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (series === null) return <Skeleton height={280} radius={24} />

  if (error) {
    return (
      <View className="bg-surface border border-border rounded-3xl p-6 items-center">
        <Text className="text-gray-400 text-center">{error}</Text>
        <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
          <Text className="text-black font-semibold">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (series.length === 0) {
    return (
      <View className="bg-surface border border-border rounded-3xl p-8 items-center">
        <IconBadge colors={gradients.violet} size={56} radius={18}>
          <Dumbbell color="#ffffff" size={26} />
        </IconBadge>
        <Text className="text-white font-bold text-base mt-4">Tu fuerza, ejercicio por ejercicio</Text>
        <Text className="text-gray-400 text-sm text-center mt-1">
          Anota el peso cuando entrenes y aquí verás cómo sube cada ejercicio.
        </Text>
      </View>
    )
  }

  const selected = series.find((s) => s.exerciseId === selectedId) || series[0]
  const weights = selected.points.map((p) => p.weight)
  const best = Math.max(...weights)
  const gain = Math.round((weights[weights.length - 1] - weights[0]) * 100) / 100
  const bestOneRm = Math.max(...selected.points.map((p) => p.oneRm))
  const level = strengthLevel(selected.name, bestOneRm, body.weightKg, body.gender)
  const labelStep = Math.max(1, Math.ceil(selected.points.length / 4))
  const labels = selected.points.map((p, i) =>
    (selected.points.length - 1 - i) % labelStep === 0
      ? new Date(p.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      : ''
  )

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
        {series.map((s) => {
          const active = s.exerciseId === selected.exerciseId
          return (
            <Pressable
              key={s.exerciseId}
              onPress={() => setSelectedId(s.exerciseId)}
              className={`px-3.5 py-2 rounded-full border ${active ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
            >
              <Text className={active ? 'text-black text-xs font-bold' : 'text-gray-300 text-xs'}>{s.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View className="flex-row justify-between mb-3">
        <View className="bg-surface border border-border rounded-3xl p-4" style={{ width: '48.5%' }}>
          <Text className="text-gray-400 text-xs">Mejor marca</Text>
          <View className="flex-row items-end mt-1">
            <CountUp value={best} decimals={Number.isInteger(best) ? 0 : 1} className="text-white text-2xl font-extrabold" />
            <Text className="text-gray-400 text-xs mb-1 ml-1">kg</Text>
          </View>
        </View>
        <View className="bg-surface border border-border rounded-3xl p-4" style={{ width: '48.5%' }}>
          <Text className="text-gray-400 text-xs">Desde tu primera sesión</Text>
          <Text className={`text-2xl font-extrabold mt-1 ${gain > 0 ? 'text-primary' : 'text-white'}`}>
            {(gain > 0 ? '+' : '') + gain + ' kg'}
          </Text>
        </View>
      </View>

      {/* 1RM estimado y nivel de fuerza relativo al peso corporal */}
      <View className="rounded-3xl overflow-hidden p-4 mb-3" style={{ borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' }}>
        <GradientFill colors={['#1e1b4b', '#141b19']} direction="horizontal" />
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-violet-300 text-xs font-semibold">1RM estimado</Text>
            <View className="flex-row items-end mt-0.5">
              <CountUp value={bestOneRm} decimals={Number.isInteger(bestOneRm) ? 0 : 1} className="text-white text-3xl font-extrabold" />
              <Text className="text-gray-400 text-xs mb-1.5 ml-1">kg</Text>
            </View>
            <Text className="text-gray-500 text-[11px]">El máximo que podrías levantar 1 vez</Text>
          </View>
          {level ? (
            <View className="items-end">
              <View className="bg-violet-500/20 border border-violet-400/40 rounded-full px-3 py-1">
                <Text className="text-violet-200 text-xs font-extrabold">{level.level}</Text>
              </View>
              <Text className="text-gray-400 text-[11px] mt-1.5">{formatKg(level.ratio) + '× tu peso corporal'}</Text>
            </View>
          ) : null}
        </View>
        {level?.next ? (
          <Text className="text-gray-400 text-xs mt-3">
            {'Para nivel ' + level.next.level + ' necesitas un 1RM de ' + formatKg(level.next.kg) + ' kg (te faltan ' + formatKg(Math.max(0, level.next.kg - bestOneRm)) + ' kg).'}
          </Text>
        ) : null}
      </View>

      <View className="bg-surface border border-border rounded-3xl p-5">
        <Text className="text-white font-semibold text-sm mb-3">{selected.name}</Text>
        {selected.points.length < 2 ? (
          <Text className="text-gray-500 text-sm text-center py-8">
            Entrena este ejercicio al menos 2 días para ver tu evolución.
          </Text>
        ) : (
          <LineChart
            data={{ labels, datasets: [{ data: weights }] }}
            width={screenWidth - 72}
            height={200}
            withVerticalLines={false}
            withOuterLines={false}
            bezier
            yAxisSuffix=" kg"
            chartConfig={{
              backgroundColor: '#141b19',
              backgroundGradientFrom: '#141b19',
              backgroundGradientTo: '#141b19',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 120, 118, ${opacity})`,
              fillShadowGradientFrom: '#a78bfa',
              fillShadowGradientFromOpacity: 0.35,
              fillShadowGradientTo: '#a78bfa',
              fillShadowGradientToOpacity: 0,
              propsForDots: { r: '3', strokeWidth: '0', fill: '#a78bfa' },
              propsForBackgroundLines: { stroke: '#1f2926', strokeDasharray: '3 3' },
            }}
            style={{ marginLeft: -12, borderRadius: 12 }}
          />
        )}
        <Text className="text-gray-500 text-xs mt-2">
          {selected.points.length + (selected.points.length === 1 ? ' sesión registrada' : ' sesiones registradas')}
        </Text>
      </View>
    </View>
  )
}
