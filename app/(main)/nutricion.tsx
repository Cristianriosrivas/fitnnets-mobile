import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl, Alert, Dimensions, ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { LineChart } from 'react-native-chart-kit'
import Svg, { Circle } from 'react-native-svg'
import {
  Sparkles, Plus, Pencil, Check, Calculator, CheckCircle2, Circle as CircleIcon,
  Sunrise, Sun, Moon, Cookie, Trash2, TrendingUp, Droplet,
} from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

const screenWidth = Dimensions.get('window').width

const mealIcons: Record<string, any> = { desayuno: Sunrise, almuerzo: Sun, cena: Moon, snack: Cookie }
const mealLabels: Record<string, string> = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', snack: 'Snack' }
const mealOrder = ['desayuno', 'almuerzo', 'cena', 'snack']

const TIPS = [
  'Mantén una buena hidratación. El agua mejora tu rendimiento y recuperación.',
  'La proteína después de entrenar ayuda a la recuperación muscular.',
  'No te saltes comidas: eso suele llevar a comer de más después.',
  'Los vegetales de hoja verde te ayudan a mantenerte saciado por más tiempo.',
]

const RING_RADIUS = 42
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getWeekDays() {
  const days = []
  const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const todayDate = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(todayDate.getDate() - i)
    days.push({
      dateStr: d.toISOString().split('T')[0],
      label: dayLabels[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
    })
  }
  return days
}

export default function NutricionScreen() {
  const today = getToday()
  const weekDays = getWeekDays()

  const [loading, setLoading] = useState(true)
  const [planLoading, setPlanLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)
  const [trend, setTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])

  const [showIngredientsBox, setShowIngredientsBox] = useState(false)
  const [ingredients, setIngredients] = useState('')

  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editCalories, setEditCalories] = useState('')
  const [estimating, setEstimating] = useState(false)

  const [showManualForm, setShowManualForm] = useState(false)
  const [manualMeals, setManualMeals] = useState<{ meal_type: string; description: string; calories: string }[]>([
    { meal_type: 'desayuno', description: '', calories: '' },
  ])

  const isToday = selectedDate === today

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
    setUsername(profile?.username || '')

    const { data } = await supabase
      .from('meal_plans')
      .select('id, daily_calories, protein_g, carbs_g, fats_g, plan_date, meals(id, meal_type, description, calories, consumed)')
      .eq('plan_date', selectedDate)
      .maybeSingle()
    setPlan(data)

    // Tendencia real de cumplimiento de los ultimos 7 dias
    const dates = getWeekDays().map((d) => d.dateStr)
    const { data: weekPlans } = await supabase
      .from('meal_plans')
      .select('plan_date, daily_calories, meals(calories, consumed)')
      .in('plan_date', dates)

    const byDate: Record<string, number> = {}
    ;(weekPlans || []).forEach((p: any) => {
      const consumed = (p.meals || [])
        .filter((m: any) => m.consumed)
        .reduce((sum: number, m: any) => sum + (m.calories || 0), 0)
      byDate[p.plan_date] = p.daily_calories ? Math.min(100, Math.round((consumed / p.daily_calories) * 100)) : 0
    })
    setTrend(dates.map((dt) => byDate[dt] ?? 0))

    setLoading(false)
    setPlanLoading(false)
  }, [selectedDate])

  // Recarga cada vez que la pantalla vuelve a estar en foco o cambia el dia elegido
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

  const selectDay = (dateStr: string) => {
    if (dateStr === selectedDate) return
    setPlanLoading(true)
    setEditingMealId(null)
    setShowIngredientsBox(false)
    setShowManualForm(false)
    setError('')
    setSelectedDate(dateStr)
  }

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const headers = await getAuthHeader()
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/generate-mealplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ingredients }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al generar el plan')
        setGenerating(false)
        return
      }
      await loadData()
      setShowIngredientsBox(false)
    } catch (e) {
      setError('No se pudo conectar con el servidor')
    }
    setGenerating(false)
  }

  const startEditMeal = (meal: any) => {
    setEditingMealId(meal.id)
    setEditDescription(meal.description)
    setEditCalories(String(meal.calories))
  }

  const handleEstimateCalories = async () => {
    if (!editDescription.trim()) return
    setEstimating(true)
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/estimate-calories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription }),
      })
      const data = await res.json()
      if (res.ok && data.calories) setEditCalories(String(data.calories))
    } catch (e) {
      // silencioso: el usuario puede escribir el numero a mano
    }
    setEstimating(false)
  }

  const saveEditMeal = async () => {
    if (!editingMealId) return
    await supabase
      .from('meals')
      .update({ description: editDescription, calories: parseInt(editCalories) || 0 })
      .eq('id', editingMealId)
    setEditingMealId(null)
    await loadData()
  }

  const toggleConsumed = async (meal: any) => {
    await supabase.from('meals').update({ consumed: !meal.consumed }).eq('id', meal.id)
    await loadData()
  }

  const handleDeletePlan = () => {
    if (!plan) return
    Alert.alert(
      isToday ? 'Borrar plan de hoy' : 'Borrar plan de este dia',
      'Seguro que quieres borrar este plan de comidas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            const { error: mealsError } = await supabase.from('meals').delete().eq('meal_plan_id', plan.id)
            if (mealsError) {
              Alert.alert('No se pudo borrar', mealsError.message)
              return
            }

            // .select('id') devuelve las filas borradas: si viene vacio, la base de datos
            // rechazo el borrado en silencio (falta la politica de RLS de borrado)
            const { data, error: planError } = await supabase
              .from('meal_plans')
              .delete()
              .eq('id', plan.id)
              .select('id')

            if (planError || !data || data.length === 0) {
              Alert.alert('No se pudo borrar', planError?.message || 'Revisa la politica de borrado en Supabase.')
              return
            }

            setPlan(null)
            setEditingMealId(null)
            await loadData()
          },
        },
      ]
    )
  }

  // ----- Plan manual -----
  const addManualMealRow = () =>
    setManualMeals((p) => [...p, { meal_type: 'snack', description: '', calories: '' }])
  const removeManualMealRow = (i: number) => setManualMeals((p) => p.filter((_, idx) => idx !== i))
  const updateManualMeal = (i: number, field: string, value: string) =>
    setManualMeals((p) => p.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)))

  const saveManualPlan = async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const validMeals = manualMeals.filter((m) => m.description.trim())
    if (validMeals.length === 0) {
      setError('Agrega al menos una comida con descripcion')
      return
    }

    if (plan) {
      await supabase.from('meals').delete().eq('meal_plan_id', plan.id)
      await supabase.from('meal_plans').delete().eq('id', plan.id)
    }

    const totalCalories = validMeals.reduce((sum, m) => sum + (parseInt(m.calories) || 0), 0)
    const { data: newPlan, error: planError } = await supabase
      .from('meal_plans')
      .insert({ user_id: user.id, plan_date: getToday(), daily_calories: totalCalories, generated_by_ai: false })
      .select()
      .single()

    if (planError) {
      setError(planError.message)
      return
    }

    const mealsToInsert = validMeals.map((m) => ({
      meal_plan_id: newPlan.id,
      meal_type: m.meal_type,
      description: m.description,
      calories: parseInt(m.calories) || 0,
    }))
    const { error: mealsError } = await supabase.from('meals').insert(mealsToInsert)
    if (mealsError) {
      setError(mealsError.message)
      return
    }

    setShowManualForm(false)
    setManualMeals([{ meal_type: 'desayuno', description: '', calories: '' }])
    await loadData()
  }

  // ----- Calculos para la tarjeta de cumplimiento -----
  const consumedCalories =
    plan?.meals?.filter((m: any) => m.consumed).reduce((s: number, m: any) => s + m.calories, 0) || 0
  const compliancePercent = plan?.daily_calories
    ? Math.min(100, Math.round((consumedCalories / plan.daily_calories) * 100))
    : 0
  const consumedMealsCount = plan?.meals?.filter((m: any) => m.consumed).length || 0
  const totalMealsCount = plan?.meals?.length || 0

  const macroTotal = (plan?.protein_g || 0) * 4 + (plan?.carbs_g || 0) * 4 + (plan?.fats_g || 0) * 9
  const proteinPct = macroTotal ? Math.round(((plan.protein_g * 4) / macroTotal) * 100) : 0
  const carbsPct = macroTotal ? Math.round(((plan.carbs_g * 4) / macroTotal) * 100) : 0
  const fatsPct = macroTotal ? Math.round(((plan.fats_g * 9) / macroTotal) * 100) : 0

  const tipOfDay = TIPS[new Date().getDate() % TIPS.length]
  const trendHasData = trend.some((v) => v > 0)

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
      <Text className="text-white text-2xl font-bold">¡Hola, {username || 'atleta'}! 🔥</Text>
      <Text className="text-gray-400 text-sm mt-0.5 mb-5">Tu alimentación es el combustible para tus metas.</Text>

      {/* Cumplimiento + macros */}
      <View className="bg-surface border border-border rounded-2xl p-5 mb-5">
        {plan && (
          <Pressable onPress={handleDeletePlan} className="p-1.5" style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
            <Trash2 color="#6b7876" size={18} />
          </Pressable>
        )}

        <View className="items-center mb-5">
          <ProgressRing percent={compliancePercent} caption={'Cumplimiento\ndiario'} />
        </View>

        <Text className="text-white text-2xl font-bold mb-3">
          {consumedCalories}{' '}
          <Text className="text-sm font-medium text-gray-500">/ {plan?.daily_calories || 0} kcal</Text>
        </Text>

        <View className="flex-row gap-2.5">
          <MacroBox
            label="Proteínas"
            grams={plan?.protein_g || 0}
            pct={proteinPct}
            boxClass="bg-red-500/10 border-red-500/20"
            labelColor="#f87171"
            valueColor="#fca5a5"
          />
          <MacroBox
            label="Carbohidratos"
            grams={plan?.carbs_g || 0}
            pct={carbsPct}
            boxClass="bg-amber-500/10 border-amber-500/20"
            labelColor="#fbbf24"
            valueColor="#fcd34d"
          />
          <MacroBox
            label="Grasas"
            grams={plan?.fats_g || 0}
            pct={fatsPct}
            boxClass="bg-blue-500/10 border-blue-500/20"
            labelColor="#60a5fa"
            valueColor="#93c5fd"
          />
        </View>
      </View>

      {/* Acciones (solo para el dia de hoy) */}
      {isToday && (
        <View className="gap-3 mb-5">
          <Pressable
            onPress={() => setShowIngredientsBox((v) => !v)}
            disabled={generating}
            className="bg-primary rounded-xl py-3 flex-row items-center justify-center gap-2"
            style={{ opacity: generating ? 0.5 : 1 }}
          >
            <Sparkles color="black" size={16} />
            <Text className="text-black font-semibold text-sm">
              {generating ? 'Generando...' : plan?.meals?.length ? 'Regenerar con IA' : 'Generar plan con IA'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowManualForm((v) => !v)}
            className="bg-surface2 border border-border rounded-xl py-3 flex-row items-center justify-center gap-2"
          >
            <Plus color="#e5e7eb" size={16} />
            <Text className="text-gray-200 font-medium text-sm">Crear mi propio plan</Text>
          </Pressable>
        </View>
      )}

      {/* Ingredientes para la IA */}
      {isToday && showIngredientsBox && (
        <View className="bg-surface border border-border rounded-2xl p-4 mb-5">
          <Text className="text-white font-medium text-sm mb-1">¿Qué alimentos tienes disponibles hoy?</Text>
          <Text className="text-gray-500 text-xs mb-2">Ej: pollo, arroz, huevos, avena, plátano, atún...</Text>
          <TextInput
            value={ingredients}
            onChangeText={setIngredients}
            multiline
            placeholder="Escribe los alimentos que tienes, separados por comas"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white"
            style={{ minHeight: 64, textAlignVertical: 'top' }}
          />
          <Pressable
            onPress={handleGenerate}
            disabled={generating}
            className="bg-primary rounded-lg py-3 items-center mt-3 flex-row justify-center gap-2"
            style={{ opacity: generating ? 0.5 : 1 }}
          >
            {generating && <ActivityIndicator color="black" size="small" />}
            <Text className="text-black font-semibold text-sm">
              {generating ? 'Generando...' : 'Generar mi plan de hoy'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Plan manual */}
      {isToday && showManualForm && (
        <View className="bg-surface border border-border rounded-2xl p-4 mb-5">
          <Text className="text-white font-semibold text-sm mb-3">Arma tu plan de hoy</Text>

          {manualMeals.map((m, index) => (
            <View key={index} className="bg-surface2 rounded-xl p-3 mb-3">
              <View className="flex-row flex-wrap gap-1.5 mb-2">
                {mealOrder.map((t) => {
                  const selected = m.meal_type === t
                  return (
                    <Pressable
                      key={t}
                      onPress={() => updateManualMeal(index, 'meal_type', t)}
                      className={`px-3 py-1 rounded-full border ${
                        selected ? 'bg-primary border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <Text className={`text-xs font-medium ${selected ? 'text-black' : 'text-gray-400'}`}>
                        {mealLabels[t]}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                value={m.description}
                onChangeText={(v) => updateManualMeal(index, 'description', v)}
                placeholder="Descripción de la comida"
                placeholderTextColor="#6b7876"
                className="bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              />
              <View className="flex-row items-center gap-3 mt-2">
                <TextInput
                  value={m.calories}
                  onChangeText={(v) => updateManualMeal(index, 'calories', v)}
                  keyboardType="number-pad"
                  placeholder="Kcal"
                  placeholderTextColor="#6b7876"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
                  style={{ width: 96 }}
                />
                {manualMeals.length > 1 && (
                  <Pressable onPress={() => removeManualMealRow(index)} className="p-1">
                    <Trash2 color="#6b7876" size={16} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          <Pressable onPress={addManualMealRow} className="flex-row items-center gap-1.5 mt-1">
            <Plus color="#22c55e" size={14} />
            <Text className="text-primary text-sm font-medium">Agregar otra comida</Text>
          </Pressable>

          <Pressable onPress={saveManualPlan} className="bg-primary rounded-lg py-3 items-center mt-4">
            <Text className="text-black font-semibold text-sm">Guardar mi plan de hoy</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <Text className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">
          {error}
        </Text>
      ) : null}

      {/* Selector de dias */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-semibold text-sm">Tu plan de alimentación</Text>
        <Text className="text-gray-500 text-xs">
          {consumedMealsCount}/{totalMealsCount} completadas
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" style={{ flexGrow: 0 }}>
        {weekDays.map((d) => {
          const selected = d.dateStr === selectedDate
          return (
            <Pressable
              key={d.dateStr}
              onPress={() => selectDay(d.dateStr)}
              className={`rounded-xl items-center justify-center mr-2 border ${
                selected
                  ? 'bg-primary border-primary'
                  : d.isToday
                  ? 'bg-surface border-primary/50'
                  : 'bg-surface border-border'
              }`}
              style={{ width: 44, height: 56 }}
            >
              <Text className={`text-xs font-medium ${selected ? 'text-black' : 'text-gray-500'}`}>{d.label}</Text>
              <Text className={`text-sm font-bold ${selected ? 'text-black' : 'text-gray-400'}`}>{d.dayNum}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Lista de comidas */}
      {planLoading ? (
        <View className="py-10 items-center">
          <ActivityIndicator color="#22c55e" />
        </View>
      ) : !plan ? (
        <View className="bg-surface border border-border rounded-2xl p-8 items-center mb-5">
          <Text className="text-gray-400 text-center">
            {isToday ? 'Aún no tienes un plan para hoy.' : 'No hay un plan para este día.'}
          </Text>
          {isToday && (
            <Text className="text-gray-500 text-sm text-center mt-1">Genera uno con IA o créalo tú mismo 👆</Text>
          )}
        </View>
      ) : (
        <View className="mb-5">
          {mealOrder.map((type) => {
            const meal = plan.meals?.find((m: any) => m.meal_type === type)
            if (!meal) return null
            const Icon = mealIcons[type]
            const isEditing = editingMealId === meal.id

            return (
              <View
                key={meal.id}
                className={`bg-surface border rounded-2xl p-4 mb-3 flex-row items-start gap-3 ${
                  meal.consumed ? 'border-green-500/40' : 'border-border'
                }`}
              >
                <Pressable onPress={() => toggleConsumed(meal)} className="mt-0.5">
                  {meal.consumed ? (
                    <CheckCircle2 color="#22c55e" size={22} />
                  ) : (
                    <CircleIcon color="#2a3532" size={22} />
                  )}
                </Pressable>

                <View className="bg-green-500/10 rounded-lg p-2">
                  <Icon color="#22c55e" size={20} />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className={`font-semibold text-sm ${meal.consumed ? 'text-gray-500' : 'text-white'}`}>
                      {mealLabels[type]}
                    </Text>
                    {isEditing ? (
                      <View className="flex-row items-center gap-1.5">
                        <TextInput
                          value={editCalories}
                          onChangeText={setEditCalories}
                          keyboardType="number-pad"
                          className="bg-surface2 border border-border rounded px-2 py-1 text-white text-xs text-right"
                          style={{ width: 60 }}
                        />
                        <Pressable onPress={handleEstimateCalories} disabled={estimating}>
                          {estimating ? (
                            <ActivityIndicator color="#22c55e" size="small" />
                          ) : (
                            <Calculator color="#22c55e" size={14} />
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <Text className="text-gray-500 text-xs">{meal.calories} kcal</Text>
                    )}
                  </View>

                  {isEditing ? (
                    <TextInput
                      value={editDescription}
                      onChangeText={setEditDescription}
                      multiline
                      className="bg-surface2 border border-border rounded-lg px-2 py-1.5 text-white text-sm mt-1"
                    />
                  ) : (
                    <Text
                      className={`text-sm mt-1 ${meal.consumed ? 'text-gray-500' : 'text-gray-400'}`}
                      style={meal.consumed ? { textDecorationLine: 'line-through' } : undefined}
                    >
                      {meal.description}
                    </Text>
                  )}
                </View>

                <Pressable onPress={() => (isEditing ? saveEditMeal() : startEditMeal(meal))}>
                  {isEditing ? <Check color="#22c55e" size={18} /> : <Pencil color="#6b7876" size={16} />}
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      {/* Tu progreso nutricional */}
      <View className="bg-surface border border-border rounded-2xl p-4 mb-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <TrendingUp color="#22c55e" size={15} />
          <Text className="text-white font-semibold text-sm">Tu progreso nutricional</Text>
        </View>

        {trendHasData ? (
          <LineChart
            data={{
              labels: weekDays.map((d) => d.label),
              datasets: [{ data: trend }],
            }}
            width={screenWidth - 64}
            height={110}
            fromZero
            bezier
            withHorizontalLabels={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            chartConfig={{
              backgroundColor: '#141b19',
              backgroundGradientFrom: '#141b19',
              backgroundGradientTo: '#141b19',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 120, 118, ${opacity})`,
              fillShadowGradientFrom: '#22c55e',
              fillShadowGradientFromOpacity: 0.4,
              fillShadowGradientTo: '#22c55e',
              fillShadowGradientToOpacity: 0,
              propsForDots: { r: '3', strokeWidth: '0', fill: '#22c55e' },
            }}
            style={{ marginLeft: -40, borderRadius: 12 }}
          />
        ) : (
          <Text className="text-gray-500 text-xs text-center py-6">
            Marca tus comidas como consumidas para ver tu tendencia.
          </Text>
        )}
        <Text className="text-gray-500 text-center mt-1" style={{ fontSize: 10 }}>
          Cumplimiento de los últimos 7 días
        </Text>
      </View>

      {/* Consejo */}
      <View className="bg-surface border border-border rounded-2xl p-4">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Sparkles color="#60a5fa" size={15} />
          <Text className="text-white font-semibold text-sm">Consejo de tu IA</Text>
        </View>
        <View className="flex-row items-start gap-2.5">
          <View className="bg-blue-500/15 rounded-lg p-2">
            <Droplet color="#60a5fa" size={16} />
          </View>
          <Text className="flex-1 text-gray-400 text-xs leading-5">{tipOfDay}</Text>
        </View>
      </View>
    </ScrollView>
  )
}

function MacroBox({
  label, grams, pct, boxClass, labelColor, valueColor,
}: {
  label: string
  grams: number
  pct: number
  boxClass: string
  labelColor: string
  valueColor: string
}) {
  return (
    <View className={`flex-1 border rounded-lg p-2.5 items-center ${boxClass}`}>
      <Text style={{ fontSize: 10, color: labelColor, fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: valueColor, fontWeight: '700' }}>{grams}g</Text>
      <Text style={{ fontSize: 9, color: labelColor, opacity: 0.7 }}>({pct}%)</Text>
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
        <Text style={{ fontSize: 9, color: '#9ca8a5', textAlign: 'center', lineHeight: 11 }}>{caption}</Text>
      </View>
    </View>
  )
}