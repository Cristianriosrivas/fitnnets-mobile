import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../core/supabase/client'

const TOTAL_STEPS = 6

export default function OnboardingScreen() {
  const router = useRouter()
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
    router.replace('/(main)/dashboard')
  }

  const OptionButton = ({
    selected,
    onPress,
    children,
  }: {
    selected: boolean
    onPress: () => void
    children: React.ReactNode
  }) => (
    <Pressable
      onPress={onPress}
      className={`px-4 py-3 rounded-xl border mb-2 ${
        selected ? 'bg-primary border-primary' : 'bg-surface2 border-border'
      }`}
    >
      <Text className={selected ? 'text-black font-semibold' : 'text-white'}>{children}</Text>
    </Pressable>
  )

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <View className="flex-row gap-2 mb-6">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <View
            key={s}
            className="flex-1 h-1.5 rounded-full"
            style={{ backgroundColor: s <= step ? '#22c55e' : '#1f2926' }}
          />
        ))}
      </View>

      <Text className="text-gray-500 text-xs mb-1">Paso {step} de {TOTAL_STEPS}</Text>

      {step === 1 && (
        <View>
          <Text className="text-white text-xl font-bold mb-4">Cuentanos sobre ti</Text>

          <Text className="text-gray-400 text-sm mb-1">Edad</Text>
          <TextInput
            value={formData.age}
            onChangeText={(v) => updateField('age', v)}
            keyboardType="number-pad"
            placeholder="ej: 25"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
          />

          <Text className="text-gray-400 text-sm mb-2">Genero</Text>
          <View className="flex-row gap-2">
            {['masculino', 'femenino', 'otro'].map((g) => (
              <Pressable
                key={g}
                onPress={() => updateField('gender', g)}
                className={`flex-1 py-2.5 rounded-xl border items-center ${
                  formData.gender === g ? 'bg-primary border-primary' : 'bg-surface2 border-border'
                }`}
              >
                <Text className={formData.gender === g ? 'text-black font-semibold capitalize' : 'text-white capitalize'}>
                  {g}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text className="text-white text-xl font-bold mb-4">Tus medidas actuales</Text>

          <Text className="text-gray-400 text-sm mb-1">Peso (kg)</Text>
          <TextInput
            value={formData.weight_kg}
            onChangeText={(v) => updateField('weight_kg', v)}
            keyboardType="decimal-pad"
            placeholder="ej: 70"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
          />

          <Text className="text-gray-400 text-sm mb-1">Altura (cm)</Text>
          <TextInput
            value={formData.height_cm}
            onChangeText={(v) => updateField('height_cm', v)}
            keyboardType="number-pad"
            placeholder="ej: 175"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
          />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text className="text-white text-xl font-bold mb-4">Cual es tu objetivo?</Text>

          <Text className="text-gray-400 text-sm mb-2">Meta principal</Text>
          {[
            { value: 'perder_grasa', label: 'Perder grasa' },
            { value: 'ganar_musculo', label: 'Ganar musculo' },
            { value: 'mantenimiento', label: 'Mantenimiento' },
            { value: 'resistencia', label: 'Mejorar resistencia' },
          ].map((opt) => (
            <OptionButton
              key={opt.value}
              selected={formData.goal === opt.value}
              onPress={() => updateField('goal', opt.value)}
            >
              {opt.label}
            </OptionButton>
          ))}

          <Text className="text-gray-400 text-sm mb-2 mt-3">Nivel de actividad actual</Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { value: 'sedentario', label: 'Sedentario' },
              { value: 'ligero', label: 'Ligero' },
              { value: 'moderado', label: 'Moderado' },
              { value: 'intenso', label: 'Intenso' },
            ].map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => updateField('activity_level', opt.value)}
                className={`px-4 py-2 rounded-xl border ${
                  formData.activity_level === opt.value ? 'bg-primary border-primary' : 'bg-surface2 border-border'
                }`}
                style={{ width: '48%' }}
              >
                <Text className={formData.activity_level === opt.value ? 'text-black font-semibold text-center' : 'text-white text-center'}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 4 && (
        <View>
          <Text className="text-white text-xl font-bold mb-2">Cual es tu tipo de cuerpo?</Text>
          <Text className="text-gray-400 text-sm mb-4">
            Esto se llama somatotipo. Conocerlo ayuda a la IA a disenar una rutina y un plan de
            alimentacion mas precisos. Elige el que mas se parezca a ti.
          </Text>

          {[
            { value: 'ectomorfo', title: 'Ectomorfo', desc: 'Delgado, extremidades largas, le cuesta subir de peso o ganar musculo.' },
            { value: 'mesomorfo', title: 'Mesomorfo', desc: 'Complexion atletica, gana musculo con relativa facilidad.' },
            { value: 'endomorfo', title: 'Endomorfo', desc: 'Complexion mas robusta, tiende a acumular grasa con mas facilidad.' },
          ].map((bt) => {
            const selected = formData.body_type === bt.value
            return (
              <Pressable
                key={bt.value}
                onPress={() => updateField('body_type', bt.value)}
                className={`px-4 py-3 rounded-xl border mb-2 ${
                  selected ? 'bg-primary border-primary' : 'bg-surface2 border-border'
                }`}
              >
                <Text className={selected ? 'text-black font-semibold' : 'text-white font-semibold'}>
                  {bt.title}
                </Text>
                <Text className={selected ? 'text-black/70 text-xs mt-0.5' : 'text-gray-500 text-xs mt-0.5'}>
                  {bt.desc}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {step === 5 && (
        <View>
          <Text className="text-white text-xl font-bold mb-4">Donde vas a entrenar?</Text>
          {[
            { value: 'gym', label: 'Gimnasio (con maquinas y pesas)' },
            { value: 'casa', label: 'En casa (con o sin equipo basico)' },
            { value: 'calistenia', label: 'Calistenia (peso corporal)' },
          ].map((opt) => (
            <OptionButton
              key={opt.value}
              selected={formData.training_place === opt.value}
              onPress={() => updateField('training_place', opt.value)}
            >
              {opt.label}
            </OptionButton>
          ))}
        </View>
      )}

      {step === 6 && (
        <View>
          <Text className="text-white text-xl font-bold mb-1">Medidas detalladas</Text>
          <Text className="text-gray-400 text-sm mb-4">
            Este paso es totalmente opcional. Puedes dejar en blanco lo que no sepas.
          </Text>

          {[
            { key: 'chest_cm', label: 'Pecho (cm)' },
            { key: 'waist_cm', label: 'Cintura (cm)' },
            { key: 'hip_cm', label: 'Cadera (cm)' },
            { key: 'glute_cm', label: 'Gluteos (cm)' },
            { key: 'bicep_cm', label: 'Biceps (cm)' },
            { key: 'thigh_cm', label: 'Muslo (cm)' },
          ].map((field) => (
            <View key={field.key} className="mb-3">
              <Text className="text-gray-500 text-xs mb-1">{field.label}</Text>
              <TextInput
                value={(formData as any)[field.key]}
                onChangeText={(v) => updateField(field.key, v)}
                keyboardType="decimal-pad"
                placeholder="Opcional"
                placeholderTextColor="#6b7876"
                className="bg-surface2 border border-border rounded-xl px-3 py-2.5 text-white"
              />
            </View>
          ))}
        </View>
      )}

      {error ? <Text className="text-red-400 text-sm mt-3">{error}</Text> : null}

      <View className="flex-row gap-3 mt-6">
        {step > 1 && (
          <Pressable
            onPress={() => setStep(step - 1)}
            className="bg-surface2 border border-border rounded-xl px-4 py-3 items-center justify-center"
          >
            <Text className="text-white font-medium">Atras</Text>
          </Pressable>
        )}

        {step < TOTAL_STEPS ? (
          <Pressable
            onPress={() => canGoNext() && setStep(step + 1)}
            disabled={!canGoNext()}
            className="bg-primary rounded-xl py-3 items-center flex-1"
            style={{ opacity: canGoNext() ? 1 : 0.4 }}
          >
            <Text className="text-black font-semibold">Continuar</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="bg-primary rounded-xl py-3 items-center flex-1"
            style={{ opacity: loading ? 0.5 : 1 }}
          >
            <Text className="text-black font-semibold">{loading ? 'Guardando...' : 'Finalizar'}</Text>
          </Pressable>
        )}
      </View>

      {step === TOTAL_STEPS && (
        <Pressable onPress={handleSubmit} disabled={loading} className="mt-3 items-center">
          <Text className="text-gray-500 text-xs">Saltar medidas y finalizar</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}