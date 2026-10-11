import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useRouter } from 'expo-router'
import { Save, Check, ArrowLeft } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

// IMPORTANTE: estos componentes van FUERA de PerfilScreen. Si se definen dentro,
// React los recrea en cada render y el TextInput pierde el foco con cada tecla.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-sm mb-1">{label}</Text>
      {children}
    </View>
  )
}

function PickerField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <Field label={label}>
      <View className="bg-surface2 border border-border rounded-xl">
        <Picker selectedValue={value} onValueChange={onChange} style={{ color: 'white' }} dropdownIconColor="#9ca8a5">
          <Picker.Item label="Selecciona" value="" color="black" />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} color="black" />
          ))}
        </Picker>
      </View>
    </Field>
  )
}

const inputClass = 'bg-surface2 border border-border rounded-xl px-4 py-3 text-white'

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
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Cargando...</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <View className="flex-row items-center gap-3 mb-5">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color="#9ca8a5" size={20} />
        </Pressable>
        <Text className="text-white text-2xl font-bold">Editar perfil</Text>
      </View>

      <Field label="Nombre de usuario">
        <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" className={inputClass} />
      </Field>
      <Field label="Edad">
        <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" className={inputClass} />
      </Field>
      <PickerField
        label="Genero" value={gender} onChange={setGender}
        options={[
          { label: 'Masculino', value: 'masculino' },
          { label: 'Femenino', value: 'femenino' },
          { label: 'Otro', value: 'otro' },
        ]}
      />
      <Field label="Peso (kg)">
        <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" className={inputClass} />
      </Field>
      <Field label="Altura (cm)">
        <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="number-pad" className={inputClass} />
      </Field>
      <PickerField
        label="Objetivo" value={goal} onChange={setGoal}
        options={[
          { label: 'Perder grasa', value: 'perder_grasa' },
          { label: 'Ganar musculo', value: 'ganar_musculo' },
          { label: 'Mantenimiento', value: 'mantenimiento' },
          { label: 'Mejorar resistencia', value: 'resistencia' },
        ]}
      />
      <PickerField
        label="Nivel de actividad" value={activityLevel} onChange={setActivityLevel}
        options={[
          { label: 'Sedentario', value: 'sedentario' },
          { label: 'Ligero', value: 'ligero' },
          { label: 'Moderado', value: 'moderado' },
          { label: 'Intenso', value: 'intenso' },
        ]}
      />
      <PickerField
        label="Tipo de cuerpo" value={bodyType} onChange={setBodyType}
        options={[
          { label: 'Ectomorfo', value: 'ectomorfo' },
          { label: 'Mesomorfo', value: 'mesomorfo' },
          { label: 'Endomorfo', value: 'endomorfo' },
        ]}
      />
      <PickerField
        label="Lugar de entrenamiento" value={trainingPlace} onChange={setTrainingPlace}
        options={[
          { label: 'Gimnasio', value: 'gym' },
          { label: 'En casa', value: 'casa' },
          { label: 'Calistenia', value: 'calistenia' },
        ]}
      />

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="bg-primary rounded-xl py-3.5 items-center flex-row justify-center gap-2"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saved ? (
          <>
            <Check color="black" size={18} />
            <Text className="text-black font-semibold">Guardado</Text>
          </>
        ) : (
          <>
            <Save color="black" size={18} />
            <Text className="text-black font-semibold">{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  )
}