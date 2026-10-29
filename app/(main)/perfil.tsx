import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Save, Check, ArrowLeft, ShieldCheck, ChevronRight, Bell, Trophy, User, Target } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import FadeIn from '../../components/ui/FadeIn'
import TiltCard from '../../components/ui/TiltCard'
import PressableScale from '../../components/ui/PressableScale'
import GradientButton from '../../components/ui/GradientButton'
import GradientFill from '../../components/ui/GradientFill'
import IconBadge from '../../components/ui/IconBadge'
import Skeleton from '../../components/ui/Skeleton'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, glow, gradients, GradientColors } from '../../components/ui/theme'

type Option = { label: string; value: string }

const GENDERS: Option[] = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Femenino', value: 'femenino' },
  { label: 'Otro', value: 'otro' },
]
const GOALS: Option[] = [
  { label: 'Perder grasa', value: 'perder_grasa' },
  { label: 'Ganar músculo', value: 'ganar_musculo' },
  { label: 'Mantenimiento', value: 'mantenimiento' },
  { label: 'Mejorar resistencia', value: 'resistencia' },
]
const ACTIVITY: Option[] = [
  { label: 'Sedentario', value: 'sedentario' },
  { label: 'Ligero', value: 'ligero' },
  { label: 'Moderado', value: 'moderado' },
  { label: 'Intenso', value: 'intenso' },
]
const BODY_TYPES: Option[] = [
  { label: 'Ectomorfo', value: 'ectomorfo' },
  { label: 'Mesomorfo', value: 'mesomorfo' },
  { label: 'Endomorfo', value: 'endomorfo' },
]
const PLACES: Option[] = [
  { label: 'Gimnasio', value: 'gym' },
  { label: 'En casa', value: 'casa' },
  { label: 'Calistenia', value: 'calistenia' },
]

const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label

// IMPORTANTE: estos componentes van FUERA de PerfilScreen. Si se definen dentro,
// React los recrea en cada render y el TextInput pierde el foco con cada tecla.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">{label}</Text>
      {children}
    </View>
  )
}

function ChipSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Option[] }) {
  return (
    <Field label={label}>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              className={`px-3.5 py-2.5 rounded-full border ${active ? 'bg-primary border-primary' : 'bg-surface2 border-border'}`}
            >
              <Text className={active ? 'text-black text-sm font-bold' : 'text-gray-300 text-sm'}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </Field>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
      <View className="flex-row items-center gap-2.5 mb-4">
        {icon}
        <Text className="text-white font-bold text-base">{title}</Text>
      </View>
      {children}
    </View>
  )
}

function MenuRow({ icon, colors: gradient, title, subtitle, onPress, last }: {
  icon: React.ReactNode
  colors: GradientColors
  title: string
  subtitle: string
  onPress: () => void
  last?: boolean
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityLabel={title}>
      <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-border'}`}>
        <IconBadge colors={gradient} size={38} radius={12}>
          {icon}
        </IconBadge>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">{title}</Text>
          <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
        </View>
        <ChevronRight color={colors.muted} size={18} />
      </View>
    </PressableScale>
  )
}

const inputClass = 'bg-surface2 border border-border rounded-2xl px-4 py-3.5 text-white'

export default function PerfilScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [age, setAge] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [gender, setGender] = useState('')
  const [goal, setGoal] = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [bodyType, setBodyType] = useState('')
  const [trainingPlace, setTrainingPlace] = useState('')
  const [originalWeight, setOriginalWeight] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      if (profile) {
        setUsername(profile.username || '')
        setAge(profile.age ? String(profile.age) : '')
        setWeightKg(profile.weight_kg ? String(profile.weight_kg) : '')
        setOriginalWeight(profile.weight_kg ? Number(profile.weight_kg) : null)
        setHeightCm(profile.height_cm ? String(profile.height_cm) : '')
        setGender(profile.gender || '')
        setGoal(profile.goal || '')
        setActivityLevel(profile.activity_level || '')
        setBodyType(profile.body_type || '')
        setTrainingPlace(profile.training_place || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        age: age ? parseInt(age) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        gender,
        goal,
        activity_level: activityLevel,
        body_type: bodyType,
        training_place: trainingPlace,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Si el peso cambio, tambien lo registramos en body_metrics para que Progreso lo vea
    const newWeight = weightKg ? parseFloat(weightKg) : null
    if (newWeight && newWeight !== originalWeight) {
      const today = new Date().toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('body_metrics')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      const result = existing
        ? await supabase.from('body_metrics').update({ weight_kg: newWeight }).eq('id', existing.id)
        : await supabase.from('body_metrics').insert({ user_id: user.id, date: today, weight_kg: newWeight })

      if (result.error) {
        setError(result.error.message)
        setSaving(false)
        return
      }
      setOriginalWeight(newWeight)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center px-4" style={{ paddingTop: 70 }}>
        <Skeleton height={96} width={96} radius={48} />
        <Skeleton height={24} width={160} radius={8} style={{ marginTop: 14 }} />
        <Skeleton height={180} radius={24} style={{ marginTop: 28 }} />
      </View>
    )
  }

  const chips = [labelOf(GOALS, goal), labelOf(PLACES, trainingPlace)].filter(Boolean) as string[]

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 48 }}
      >
        <GlowOrb color={colors.primary} size={380} style={{ top: -150, alignSelf: 'center' }} intensity={0.3} />

        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="self-start mb-2">
          <ArrowLeft color={colors.soft} size={22} />
        </Pressable>

        {/* Encabezado con avatar 3D */}
        <FadeIn style={{ alignItems: 'center', marginBottom: 22 }}>
          <TiltCard float radius={52} maxTilt={16} style={glow(colors.primary, 24, 0.55)}>
            <View style={{ width: 104, height: 104, borderRadius: 52, overflow: 'hidden', padding: 3 }}>
              <GradientFill colors={gradients.brand} radius={52} />
              <View className="flex-1 rounded-full bg-background items-center justify-center">
                <Text className="text-primary font-extrabold" style={{ fontSize: 40 }}>
                  {username?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            </View>
          </TiltCard>
          <Text className="text-white text-2xl font-extrabold mt-4">{username || 'Atleta'}</Text>
          {chips.length ? (
            <View className="flex-row gap-2 mt-2">
              {chips.map((c) => (
                <View key={c} className="bg-green-500/15 rounded-full px-3 py-1">
                  <Text className="text-primary text-xs font-semibold">{c}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </FadeIn>

        {/* Accesos */}
        <FadeIn delay={80}>
          <View className="bg-surface border border-border rounded-3xl px-4 py-1 mb-4">
            <MenuRow
              icon={<Trophy color="#422006" size={18} />}
              colors={gradients.gold}
              title="Logros e insignias"
              subtitle="Tu colección de logros"
              onPress={() => router.push('/(main)/logros')}
            />
            <MenuRow
              icon={<Bell color="#04120a" size={18} />}
              colors={gradients.brand}
              title="Recordatorios"
              subtitle="Entrenar y registrar tu peso"
              onPress={() => router.push('/(main)/recordatorios')}
            />
            <MenuRow
              icon={<ShieldCheck color="#ffffff" size={18} />}
              colors={gradients.violet}
              title="Privacidad y cuenta"
              subtitle="Tu autorización, sesión y datos"
              onPress={() => router.push('/(main)/privacidad')}
              last
            />
          </View>
        </FadeIn>

        <FadeIn delay={160}>
          <SectionCard title="Datos personales" icon={<User color={colors.primary} size={18} />}>
            <Field label="Nombre de usuario">
              <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" className={inputClass} />
            </Field>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Edad">
                  <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" className={inputClass} />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Peso (kg)">
                  <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" className={inputClass} />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Altura (cm)">
                  <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="number-pad" className={inputClass} />
                </Field>
              </View>
            </View>
            <ChipSelect label="Género" value={gender} onChange={setGender} options={GENDERS} />
            <ChipSelect label="Tipo de cuerpo" value={bodyType} onChange={setBodyType} options={BODY_TYPES} />
          </SectionCard>
        </FadeIn>

        <FadeIn delay={220}>
          <SectionCard title="Tu entrenamiento" icon={<Target color={colors.primary} size={18} />}>
            <ChipSelect label="Objetivo" value={goal} onChange={setGoal} options={GOALS} />
            <ChipSelect label="Nivel de actividad" value={activityLevel} onChange={setActivityLevel} options={ACTIVITY} />
            <ChipSelect label="Lugar de entrenamiento" value={trainingPlace} onChange={setTrainingPlace} options={PLACES} />
          </SectionCard>
        </FadeIn>

        {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

        <GradientButton
          title={saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
          onPress={handleSave}
          loading={saving}
          icon={saved ? <Check color="#04120a" size={18} strokeWidth={3} /> : <Save color="#04120a" size={18} />}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
