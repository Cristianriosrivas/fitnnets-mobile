import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl, Dimensions, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { LineChart } from 'react-native-chart-kit'
import Svg, { Circle } from 'react-native-svg'
import {
  Weight, Percent, Dumbbell, TrendingUp, TrendingDown, ArrowUp,
  Flame, Clock, Activity, Plus, Target, Check,
} from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

const screenWidth = Dimensions.get('window').width
const TABS = ['Progreso', 'Métricas', 'Metas']
const GOAL_OPTIONS = [
  { value: 'perder_grasa', label: '🔥 Perder grasa' },
  { value: 'ganar_musculo', label: '💪 Ganar músculo' },
  { value: 'mantenimiento', label: '⚖️ Mantenimiento' },
  { value: 'resistencia', label: '🏃 Mejorar resistencia' },
]
const RING_RADIUS = 42
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

export default function ProgresoScreen() {
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
      <Text className="text-white text-2xl font-bold">Tu Progreso</Text>
      <Text className="text-gray-400 text-sm mt-0.5 mb-4">Los resultados se construyen con información.</Text>

      {activeTab === 'Progreso' && (
        <Pressable
          onPress={() => setShowWeightModal(true)}
          className="bg-primary rounded-xl px-4 py-3 flex-row items-center gap-2 self-start mb-4"
        >
          <Plus color="black" size={16} />
          <Text className="text-black font-semibold text-sm">Registrar peso de hoy</Text>
        </Pressable>
      )}

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
      {activeTab === 'Métricas' && (
        <View className="bg-surface border border-border rounded-2xl p-8 items-center">
          <Text className="text-gray-400 text-center">
            Próximamente: % grasa corporal, masa muscular y más métricas detalladas 🚧
          </Text>
        </View>
      )}

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
    <View className="bg-surface border border-border rounded-2xl p-4 mb-3" style={{ width: '48.5%' }}>
      <View className="flex-row items-center gap-1.5 mb-2">
        {icon}
        <Text className="text-gray-400 text-xs flex-1">{label}</Text>
      </View>
      <Text className="text-white text-xl font-bold">{value}</Text>
      {children}
    </View>
  )
}

function ProgressRing({ percent, caption }: { percent: number; caption: string }) {
  return (
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
          strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
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
        <Text className="text-white text-lg font-bold">{percent}%</Text>
        <Text style={{ fontSize: 9, color: '#9ca8a5' }}>{caption}</Text>
      </View>
    </View>
  )
}