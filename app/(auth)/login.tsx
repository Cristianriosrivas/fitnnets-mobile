import { useState } from 'react'
import { Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Mail, Lock, ArrowRight } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { signInWithGoogle } from '../../core/googleAuth'
import AuthShell, { AuthField, GoogleButton, OrDivider } from '../../components/ui/AuthShell'
import GradientButton from '../../components/ui/GradientButton'
import { colors } from '../../components/ui/theme'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('Correo o contrasena incorrectos')
      setLoading(false)
      return
    }

    router.replace('/(main)/(tabs)/dashboard')
  }

  const handleGoogleLogin = async () => {
    setError('')
    const result = await signInWithGoogle()
    if (result === 'ok') router.replace('/(main)/(tabs)/dashboard')
    else if (result === 'error') setError('No se pudo completar el inicio con Google')
  }

  const handleForgotPassword = async () => {
    await WebBrowser.openBrowserAsync(`${process.env.EXPO_PUBLIC_API_URL}/forgot-password`)
  }

  return (
    <AuthShell title="Bienvenido de nuevo" subtitle="Disciplina hoy, resultados manana.">
      <AuthField
        label="Correo electronico"
        icon={<Mail color={colors.muted} size={18} />}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="tu@email.com"
      />
      <AuthField
        label="Contrasena"
        icon={<Lock color={colors.muted} size={18} />}
        value={password}
        onChangeText={setPassword}
        secret
        placeholder="********"
      />

      <Pressable onPress={handleForgotPassword} className="self-end mb-5 -mt-1 py-1">
        <Text className="text-primary text-xs font-semibold">Olvidaste tu contrasena?</Text>
      </Pressable>

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

      <GradientButton
        title={loading ? 'Ingresando...' : 'Iniciar sesion'}
        onPress={handleLogin}
        loading={loading}
        icon={<ArrowRight color="#04120a" size={18} />}
      />

      <OrDivider />
      <GoogleButton onPress={handleGoogleLogin} />

      <Pressable onPress={() => router.replace('/(auth)/register')} className="mt-5 py-2 items-center">
        <Text className="text-gray-400 text-sm">
          No tienes cuenta? <Text className="text-primary font-semibold">Registrate</Text>
        </Text>
      </Pressable>
    </AuthShell>
  )
}
