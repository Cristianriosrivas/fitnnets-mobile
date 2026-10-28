import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../../core/supabase/client'
import { buildConsent } from '../../core/legal'
import ConsentChecks from '../../components/ConsentChecks'

// Mensajes de Supabase Auth traducidos; lo que no se reconoce cae en un texto generico
function signUpErrorMessage(message: string) {
  const m = message.toLowerCase()
  if (m.includes('already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesion.'
  if (m.includes('password')) return 'La contrasena debe tener al menos 6 caracteres.'
  if (m.includes('email') && m.includes('invalid')) return 'El correo no es valido.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  return 'No se pudo crear la cuenta. Revisa tu conexion e intenta de nuevo.'
}

export default function RegisterScreen() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptHealth, setAcceptHealth] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleRegister = async () => {
    setError('')
    setInfo('')

    if (!username.trim() || !email.trim() || password.length < 6) {
      setError('Completa usuario, correo y una contrasena de al menos 6 caracteres.')
      return
    }
    if (!acceptTerms || !acceptHealth) {
      setError('Debes aceptar las dos autorizaciones para crear tu cuenta.')
      return
    }

    setLoading(true)
    const consent = buildConsent()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim(), ...consent },
      },
    })

    if (signUpError) {
      setError(signUpErrorMessage(signUpError.message))
      setLoading(false)
      return
    }

    // Sin sesion = el proyecto exige confirmar el correo. El consentimiento queda en los
    // metadatos y el layout de (main) lo copia al perfil en el primer inicio de sesion.
    if (!data.session) {
      setLoading(false)
      setInfo('Te enviamos un correo para confirmar tu cuenta. Confirmala y luego inicia sesion.')
      return
    }

    // El trigger handle_new_user solo crea id y username: el consentimiento se guarda aqui
    await supabase.from('profiles').update(consent).eq('id', data.session.user.id)

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
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
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
            className="bg-surface2 border border-border rounded-xl px-4 py-3 text-white mb-5"
          />

          <ConsentChecks
            terms={acceptTerms}
            health={acceptHealth}
            onTermsChange={setAcceptTerms}
            onHealthChange={setAcceptHealth}
          />

          {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}
          {info ? <Text className="text-primary text-sm mb-3">{info}</Text> : null}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="bg-primary rounded-xl py-3 items-center mt-2"
            style={{ opacity: loading || !acceptTerms || !acceptHealth ? 0.5 : 1 }}
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

          <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-5 py-2 items-center">
            <Text className="text-gray-400 text-sm">
              Ya tienes cuenta? <Text className="text-primary font-semibold">Inicia sesion</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
