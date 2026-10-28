import { useState } from 'react'
import { Text, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { User, Mail, Lock, Sparkles } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { buildConsent } from '../../core/legal'
import { signInWithGoogle } from '../../core/googleAuth'
import ConsentChecks from '../../components/ConsentChecks'
import AuthShell, { AuthField, GoogleButton, OrDivider } from '../../components/ui/AuthShell'
import GradientButton from '../../components/ui/GradientButton'
import { colors } from '../../components/ui/theme'

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

    router.replace('/(main)/(tabs)/dashboard')
  }

  const handleGoogleLogin = async () => {
    setError('')
    const result = await signInWithGoogle()
    if (result === 'ok') router.replace('/(main)/(tabs)/dashboard')
    else if (result === 'error') setError('No se pudo iniciar con Google')
  }

  const ready = acceptTerms && acceptHealth

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Tu mejor version empieza hoy.">
      <AuthField
        label="Nombre de usuario"
        icon={<User color={colors.muted} size={18} />}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholder="ej: carlos_fit"
      />
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
        placeholder="Minimo 6 caracteres"
      />

      <View className="mt-1">
        <ConsentChecks
          terms={acceptTerms}
          health={acceptHealth}
          onTermsChange={setAcceptTerms}
          onHealthChange={setAcceptHealth}
        />
      </View>

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}
      {info ? <Text className="text-primary text-sm mb-3">{info}</Text> : null}

      <GradientButton
        title={loading ? 'Creando cuenta...' : 'Registrarme'}
        onPress={handleRegister}
        loading={loading}
        icon={<Sparkles color="#04120a" size={17} />}
        style={{ marginTop: 6, opacity: ready ? 1 : 0.55 }}
      />

      <OrDivider />
      <GoogleButton onPress={handleGoogleLogin} />

      <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-5 py-2 items-center">
        <Text className="text-gray-400 text-sm">
          Ya tienes cuenta? <Text className="text-primary font-semibold">Inicia sesion</Text>
        </Text>
      </Pressable>
    </AuthShell>
  )
}
