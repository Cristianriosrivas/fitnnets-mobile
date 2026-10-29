import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Animated, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, ArrowRight, Check, Flame, Dumbbell, Scale, HeartPulse, Building2, Home, PersonStanding } from 'lucide-react-native'
import { supabase } from '../core/supabase/client'
import Aurora from '../components/ui/Aurora'
import FadeIn from '../components/ui/FadeIn'
import GradientButton from '../components/ui/GradientButton'
import GradientFill from '../components/ui/GradientFill'
import IconBadge from '../components/ui/IconBadge'
import PressableScale from '../components/ui/PressableScale'
import { colors, gradients, GradientColors } from '../components/ui/theme'

// Textos solo ASCII: pantalla previa a entrar a la app

const TOTAL_STEPS = 6

// Segmento de la barra de pasos: se llena animado al avanzar
function StepSegment({ filled }: { filled: boolean }) {
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(fill, { toValue: filled ? 1 : 0, duration: 380, useNativeDriver: true }).start()
  }, [filled, fill])
  return (
    <View className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1f2926' }}>
      <Animated.View style={{ flex: 1, transformOrigin: 'left', transform: [{ scaleX: fill }] }}>
        <GradientFill colors={gradients.brand} direction="horizontal" />
      </Animated.View>
    </View>
  )
}

function OptionCard({
  selected, onPress, title, description, icon, colors: gradient,
}: {
  selected: boolean
  onPress: () => void
  title: string
  description?: string
  icon?: React.ReactNode
  colors?: GradientColors
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View
        className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl mb-2.5"
        style={{
          backgroundColor: selected ? 'rgba(34,197,94,0.12)' : colors.surface2,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
        }}
      >
        {icon && gradient ? (
          <IconBadge colors={gradient} size={38} radius={12} shine={selected}>
            {icon}
          </IconBadge>
        ) : null}
        <View className="flex-1">
          <Text className="text-white font-bold">{title}</Text>
          {description ? <Text className="text-gray-400 text-xs mt-0.5 leading-4">{description}</Text> : null}
        </View>
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }}
        >
          {selected ? <Check color="#04120a" size={14} strokeWidth={3} /> : null}
        </View>
      </View>
    </PressableScale>
  )
}

function NumberField({ label, value, onChange, placeholder, decimal }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; decimal?: boolean }) {
  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        className="bg-surface2 border border-border rounded-2xl px-4 py-3.5 text-white text-lg font-semibold"
      />
    </View>
  )
}

function StepTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <View className="mb-5">
      <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
        {kicker}
      </Text>
      <Text className="text-white text-3xl font-extrabold mt-1">{title}</Text>
      {subtitle ? <Text className="text-gray-400 text-sm mt-2 leading-5">{subtitle}</Text> : null}
    </View>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()
  const { height } = useWindowDimensions()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    age: '',
    weight_kg: '',
    height_cm: '',
    gender: '',
    goal: '',
    activity_level: '',
    body_type: '',
    training_place: '',
    chest_cm: '',
    waist_cm: '',
    hip_cm: '',
    glute_cm: '',
    bicep_cm: '',
    thigh_cm: '',
  })

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const canGoNext = () => {
    if (step === 1) return formData.age && formData.gender
    if (step === 2) return formData.weight_kg && formData.height_cm
    if (step === 3) return formData.goal && formData.activity_level
    if (step === 4) return formData.body_type
    if (step === 5) return formData.training_place
    return true
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('No se encontro tu sesion. Inicia sesion de nuevo.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        age: parseInt(formData.age),
        weight_kg: parseFloat(formData.weight_kg),
        height_cm: parseFloat(formData.height_cm),
        gender: formData.gender,
        goal: formData.goal,
        activity_level: formData.activity_level,
        body_type: formData.body_type,
        training_place: formData.training_place,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const hasMeasurements =
      formData.chest_cm || formData.waist_cm || formData.hip_cm ||
      formData.glute_cm || formData.bicep_cm || formData.thigh_cm

    if (hasMeasurements) {
      await supabase.from('body_metrics').insert({
        user_id: user.id,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        chest_cm: formData.chest_cm ? parseFloat(formData.chest_cm) : null,
        waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
        hip_cm: formData.hip_cm ? parseFloat(formData.hip_cm) : null,
        glute_cm: formData.glute_cm ? parseFloat(formData.glute_cm) : null,
        bicep_cm: formData.bicep_cm ? parseFloat(formData.bicep_cm) : null,
        thigh_cm: formData.thigh_cm ? parseFloat(formData.thigh_cm) : null,
      })
    }

    setLoading(false)
    router.replace('/(main)/(tabs)/dashboard')
  }

  const ready = !!canGoNext()

  return (
    <View className="flex-1 bg-background">
      <Aurora height={height * 0.6} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
        >
          <View className="flex-row gap-1.5 mb-3">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <StepSegment key={s} filled={s <= step} />
            ))}
          </View>
          <Text className="text-gray-500 text-xs font-semibold mb-6">{'Paso ' + step + ' de ' + TOTAL_STEPS}</Text>

          {/* key={step}: cada paso entra con su animacion */}
          <FadeIn key={step}>
            {step === 1 && (
              <View>
                <StepTitle kicker="Empecemos" title="Cuentanos sobre ti" subtitle="Con esto la IA ajusta tus rutinas y tu plan de comidas." />
                <NumberField label="Edad" value={formData.age} onChange={(v) => updateField('age', v)} placeholder="ej: 25" />
                <Text className="text-gray-400 text-xs font-semibold mb-2 ml-1">Genero</Text>
                <View className="flex-row gap-2">
                  {[
                    { value: 'masculino', label: 'Masculino' },
                    { value: 'femenino', label: 'Femenino' },
                    { value: 'otro', label: 'Otro' },
                  ].map((g) => {
                    const active = formData.gender === g.value
                    return (
                      <Pressable
                        key={g.value}
                        onPress={() => updateField('gender', g.value)}
                        className="flex-1 py-3 rounded-2xl items-center"
                        style={{
                          backgroundColor: active ? colors.primary : colors.surface2,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text className={active ? 'text-black font-bold' : 'text-white'}>{g.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <StepTitle kicker="Tu punto de partida" title="Tus medidas actuales" subtitle="Puedes cambiarlas cuando quieras desde tu perfil." />
                <NumberField label="Peso (kg)" value={formData.weight_kg} onChange={(v) => updateField('weight_kg', v)} placeholder="ej: 70" decimal />
                <NumberField label="Altura (cm)" value={formData.height_cm} onChange={(v) => updateField('height_cm', v)} placeholder="ej: 175" />
              </View>
            )}

            {step === 3 && (
              <View>
                <StepTitle kicker="Tu meta" title="Cual es tu objetivo?" />
                {[
                  { value: 'perder_grasa', label: 'Perder grasa', icon: <Flame color="#ffffff" size={18} />, colors: gradients.ember },
                  { value: 'ganar_musculo', label: 'Ganar musculo', icon: <Dumbbell color="#04120a" size={18} />, colors: gradients.brand },
                  { value: 'mantenimiento', label: 'Mantenimiento', icon: <Scale color="#04120a" size={18} />, colors: gradients.ocean },
                  { value: 'resistencia', label: 'Mejorar resistencia', icon: <HeartPulse color="#ffffff" size={18} />, colors: gradients.violet },
                ].map((opt) => (
                  <OptionCard
                    key={opt.value}
                    selected={formData.goal === opt.value}
                    onPress={() => updateField('goal', opt.value)}
                    title={opt.label}
                    icon={opt.icon}
                    colors={opt.colors}
                  />
                ))}

                <Text className="text-gray-400 text-xs font-semibold mb-2 mt-4 ml-1">Nivel de actividad actual</Text>
                <View className="flex-row flex-wrap justify-between">
                  {[
                    { value: 'sedentario', label: 'Sedentario' },
                    { value: 'ligero', label: 'Ligero' },
                    { value: 'moderado', label: 'Moderado' },
                    { value: 'intenso', label: 'Intenso' },
                  ].map((opt) => {
                    const active = formData.activity_level === opt.value
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => updateField('activity_level', opt.value)}
                        className="py-3 rounded-2xl mb-2 items-center"
                        style={{
                          width: '48.5%',
                          backgroundColor: active ? colors.primary : colors.surface2,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text className={active ? 'text-black font-bold' : 'text-white'}>{opt.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {step === 4 && (
              <View>
                <StepTitle
                  kicker="Somatotipo"
                  title="Cual es tu tipo de cuerpo?"
                  subtitle="Conocerlo ayuda a la IA a disenar una rutina y un plan de alimentacion mas precisos. Elige el que mas se parezca a ti."
                />
                {[
                  { value: 'ectomorfo', title: 'Ectomorfo', desc: 'Delgado, extremidades largas, le cuesta subir de peso o ganar musculo.', colors: gradients.ocean },
                  { value: 'mesomorfo', title: 'Mesomorfo', desc: 'Complexion atletica, gana musculo con relativa facilidad.', colors: gradients.brand },
                  { value: 'endomorfo', title: 'Endomorfo', desc: 'Complexion mas robusta, tiende a acumular grasa con mas facilidad.', colors: gradients.ember },
                ].map((bt) => (
                  <OptionCard
                    key={bt.value}
                    selected={formData.body_type === bt.value}
                    onPress={() => updateField('body_type', bt.value)}
                    title={bt.title}
                    description={bt.desc}
                    icon={<PersonStanding color="#04120a" size={18} />}
                    colors={bt.colors}
                  />
                ))}
              </View>
            )}

            {step === 5 && (
              <View>
                <StepTitle kicker="Tu espacio" title="Donde vas a entrenar?" />
                {[
                  { value: 'gym', label: 'Gimnasio', desc: 'Con maquinas y pesas', icon: <Building2 color="#04120a" size={18} />, colors: gradients.brand },
                  { value: 'casa', label: 'En casa', desc: 'Con o sin equipo basico', icon: <Home color="#04120a" size={18} />, colors: gradients.ocean },
                  { value: 'calistenia', label: 'Calistenia', desc: 'Con tu peso corporal', icon: <PersonStanding color="#ffffff" size={18} />, colors: gradients.violet },
                ].map((opt) => (
                  <OptionCard
                    key={opt.value}
                    selected={formData.training_place === opt.value}
                    onPress={() => updateField('training_place', opt.value)}
                    title={opt.label}
                    description={opt.desc}
                    icon={opt.icon}
                    colors={opt.colors}
                  />
                ))}
              </View>
            )}

            {step === 6 && (
              <View>
                <StepTitle kicker="Opcional" title="Medidas detalladas" subtitle="Este paso es totalmente opcional. Puedes dejar en blanco lo que no sepas." />
                <View className="flex-row flex-wrap justify-between">
                  {[
                    { key: 'chest_cm', label: 'Pecho (cm)' },
                    { key: 'waist_cm', label: 'Cintura (cm)' },
                    { key: 'hip_cm', label: 'Cadera (cm)' },
                    { key: 'glute_cm', label: 'Gluteos (cm)' },
                    { key: 'bicep_cm', label: 'Biceps (cm)' },
                    { key: 'thigh_cm', label: 'Muslo (cm)' },
                  ].map((field) => (
                    <View key={field.key} style={{ width: '48.5%' }}>
                      <NumberField
                        label={field.label}
                        value={formData[field.key as keyof typeof formData]}
                        onChange={(v) => updateField(field.key, v)}
                        placeholder="Opcional"
                        decimal
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </FadeIn>

          {error ? <Text className="text-red-400 text-sm mt-3">{error}</Text> : null}

          <View className="flex-row gap-3 mt-6">
            {step > 1 && (
              <PressableScale onPress={() => setStep(step - 1)} accessibilityLabel="Atras">
                <View className="bg-surface2 border border-border rounded-2xl w-14 items-center justify-center" style={{ height: 52 }}>
                  <ArrowLeft color={colors.text} size={20} />
                </View>
              </PressableScale>
            )}

            <View className="flex-1">
              {step < TOTAL_STEPS ? (
                <GradientButton
                  title="Continuar"
                  onPress={() => ready && setStep(step + 1)}
                  disabled={!ready}
                  icon={<ArrowRight color="#04120a" size={18} />}
                />
              ) : (
                <GradientButton
                  title={loading ? 'Guardando...' : 'Finalizar'}
                  onPress={handleSubmit}
                  loading={loading}
                  icon={<Check color="#04120a" size={18} strokeWidth={3} />}
                />
              )}
            </View>
          </View>

          {step === TOTAL_STEPS && (
            <Pressable onPress={handleSubmit} disabled={loading} className="mt-4 items-center py-2">
              <Text className="text-gray-500 text-xs">Saltar medidas y finalizar</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
