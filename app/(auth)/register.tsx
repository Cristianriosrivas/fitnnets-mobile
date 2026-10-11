import { useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../../core/supabase/client'

export default function RegisterScreen() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.replace('/(main)/dashboard')
  }

  const handleGoogleLogin = async () => {
    setError('')

    const redirectUrl = Linking.createURL('auth/callback')

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    })

    if (oauthError || !data?.url) {
      setError('No se pudo iniciar con Google')
      return
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

    if (result.type !== 'success' || !result.url) {
      return
    }

    const resultUrl = result.url

    if (resultUrl.includes('#')) {
      const hash = resultUrl.split('#')[1]
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
        router.replace('/(main)/dashboard')
        return
      }
    }

    const parsed = Linking.parse(resultUrl)
    const code = parsed.queryParams?.code as string | undefined

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError('No se pudo completar el inicio con Google')
        return
      }
      router.replace('/(main)/dashboard')
      return
    }

    setError('No se pudo completar el inicio con Google')
  }

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <View className="bg-surface border border-border rounded-2xl p-6">
        <Text className="text-white text-xl font-bold text-center mb-1">
          Crea tu cuenta
        </Text>
        <Text className="text-gray-400 text-sm text-center mb-6">
          Tu mejor version empieza hoy.
        </Text>

        <Text className="text-gray-400 text-sm mb-1">Nombre de usuario</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder="ej: carlos_fit"
          placeholderTextColor="#6b7876"
          className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
        />

        <Text className="text-gray-400 text-sm mb-1">Correo electronico</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tu@email.com"
          placeholderTextColor="#6b7876"
          className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
        />

        <Text className="text-gray-400 text-sm mb-1">Contrasena</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minimo 6 caracteres"
          placeholderTextColor="#6b7876"
          className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-4"
        />

        {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          className="bg-primary rounded-xl py-3 items-center"
        >
          <Text className="text-black font-semibold">
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-3 my-5">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-gray-500 text-xs">o</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <Pressable
          onPress={handleGoogleLogin}
          className="bg-surface2 border border-border rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Continuar con Google</Text>
        </Pressable>
      </View>
    </View>
  )
}