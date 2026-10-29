import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Check, ShieldCheck } from 'lucide-react-native'
import { supabase } from '../core/supabase/client'
import { buildConsent, CONTACT_EMAIL } from '../core/legal'
import ConsentChecks from '../components/ConsentChecks'
import AuthShell from '../components/ui/AuthShell'
import GradientButton from '../components/ui/GradientButton'
import { colors } from '../components/ui/theme'

// Usuarios sin la autorizacion vigente (cuentas antiguas, Google o cambio de version de la politica).
// Textos solo ASCII: es una pantalla previa a entrar a la app.
export default function ConsentScreen() {
  const router = useRouter()
  const [terms, setTerms] = useState(false)
  const [health, setHealth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    if (!terms || !health) {
      setError('Debes aceptar las dos autorizaciones para continuar.')
      return
    }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      return
    }

    // .select('id') devuelve las filas actualizadas: si viene vacio, la base de datos rechazo el cambio
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(buildConsent())
      .eq('id', user.id)
      .select('id')

    if (updateError || !data || data.length === 0) {
      setError('No se pudo guardar tu autorizacion. Revisa tu conexion e intenta de nuevo.')
      setSaving(false)
      return
    }

    router.replace('/(main)/(tabs)/dashboard')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/(auth)/login')
  }

  return (
    <AuthShell
      title="Antes de continuar"
      subtitle="Para usar Finnets necesitamos tu autorizacion para tratar tus datos personales, incluidos tus datos de salud, segun la Ley 1581 de 2012. Puedes revocarla cuando quieras eliminando tu cuenta."
    >
      <View className="flex-row items-center gap-3 bg-surface2 rounded-2xl p-3 mb-5">
        <ShieldCheck color={colors.primary} size={20} />
        <Text className="text-gray-300 text-xs flex-1 leading-4">
          Tus datos de salud solo se usan para personalizar tus rutinas y tu plan de comidas. No los vendemos ni los usamos para publicidad.
        </Text>
      </View>

      <ConsentChecks terms={terms} health={health} onTermsChange={setTerms} onHealthChange={setHealth} />

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

      <GradientButton
        title={saving ? 'Guardando...' : 'Aceptar y continuar'}
        onPress={handleAccept}
        loading={saving}
        icon={<Check color="#04120a" size={18} strokeWidth={3} />}
        style={{ marginTop: 6, opacity: terms && health ? 1 : 0.55 }}
      />

      <Pressable onPress={handleSignOut} disabled={saving} className="mt-4 py-2 items-center">
        <Text className="text-gray-400 text-sm">No acepto, cerrar sesion</Text>
      </Pressable>

      <Text className="text-gray-500 text-xs text-center mt-3">
        {'Dudas o solicitudes sobre tus datos: ' + CONTACT_EMAIL}
      </Text>
    </AuthShell>
  )
}
