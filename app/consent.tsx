import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../core/supabase/client'
import { buildConsent, CONTACT_EMAIL } from '../core/legal'
import ConsentChecks from '../components/ConsentChecks'

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

    router.replace('/(main)/dashboard')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/(auth)/login')
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
    >
      <View className="bg-surface border border-border rounded-2xl p-6">
        <Text className="text-white text-xl font-bold mb-2">Antes de continuar</Text>
        <Text className="text-gray-400 text-sm leading-5 mb-5">
          Para usar Finnets necesitamos tu autorizacion para tratar tus datos personales, incluidos tus datos
          de salud, segun la Ley 1581 de 2012. Puedes revocarla cuando quieras eliminando tu cuenta.
        </Text>

        <ConsentChecks terms={terms} health={health} onTermsChange={setTerms} onHealthChange={setHealth} />

        {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleAccept}
          disabled={saving}
          className="bg-primary rounded-xl py-3 items-center mt-2"
          style={{ opacity: saving || !terms || !health ? 0.5 : 1 }}
        >
          <Text className="text-black font-semibold">{saving ? 'Guardando...' : 'Aceptar y continuar'}</Text>
        </Pressable>

        <Pressable onPress={handleSignOut} disabled={saving} className="mt-4 py-2 items-center">
          <Text className="text-gray-400 text-sm">No acepto, cerrar sesion</Text>
        </Pressable>

        <Text className="text-gray-500 text-xs text-center mt-3">
          {'Dudas o solicitudes sobre tus datos: ' + CONTACT_EMAIL}
        </Text>
      </View>
    </ScrollView>
  )
}
