import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Linking } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ArrowLeft, ShieldCheck, FileText, Mail, LogOut, Trash2, ChevronRight } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { CONSENT_VERSION, CONTACT_EMAIL, PRIVACY_URL, TERMS_URL } from '../../core/legal'
import FadeIn from '../../components/ui/FadeIn'
import GradientButton from '../../components/ui/GradientButton'
import IconBadge from '../../components/ui/IconBadge'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, gradients } from '../../components/ui/theme'

type ConsentRecord = {
  consent_version: string | null
  terms_accepted_at: string | null
  health_data_consent_at: string | null
}

const CONFIRM_WORD = 'ELIMINAR'

function formatDate(iso: string | null) {
  if (!iso) return 'Sin registro'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function LinkRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 py-3" style={{ minHeight: 44 }}>
      {icon}
      <Text className="text-white text-sm flex-1">{label}</Text>
      <ChevronRight color="#6b7876" size={16} />
    </Pressable>
  )
}

export default function PrivacidadScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [consent, setConsent] = useState<ConsentRecord | null>(null)

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setAccountEmail(user.email || '')

    const { data, error } = await supabase
      .from('profiles')
      .select('consent_version, terms_accepted_at, health_data_consent_at')
      .eq('id', user.id)
      .single()

    if (error) setLoadError('No pudimos cargar tu autorización.')
    else setConsent(data)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Quieres cerrar tu sesión en este teléfono?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        onPress: async () => {
          await supabase.auth.signOut({ scope: 'local' })
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')

    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    // El usuario ya no existe en el servidor: solo queda limpiar la sesión guardada en el teléfono
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/(auth)/login')
    Alert.alert('Cuenta eliminada', 'Tu cuenta y todos tus datos fueron borrados.')
  }

  const handleDelete = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán tu perfil, rutinas, progreso, planes de comida, amistades y retos. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: deleteAccount },
      ]
    )
  }

  const canDelete = confirmText.trim() === CONFIRM_WORD && !deleting
  const isCurrent = consent?.consent_version === CONSENT_VERSION

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}
    >
      <GlowOrb color={colors.violet} size={340} style={{ top: -170, right: -130 }} intensity={0.24} />
      <FadeIn>
        <View className="flex-row items-end gap-3 mb-5">
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver al perfil" hitSlop={12} className="mb-1.5">
            <ArrowLeft color={colors.soft} size={22} />
          </Pressable>
          <View>
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              Tus datos, tu decisión
            </Text>
            <Text className="text-white text-3xl font-extrabold mt-1">Privacidad</Text>
          </View>
        </View>
      </FadeIn>

      {/* Autorizacion */}
      <View className="bg-surface border border-border rounded-3xl p-5 mb-4">
        <View className="flex-row items-center gap-3 mb-4">
          <IconBadge colors={gradients.violet} size={36} radius={12}>
            <ShieldCheck color="#ffffff" size={18} />
          </IconBadge>
          <Text className="text-white font-bold text-base">Tu autorización</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#22c55e" />
        ) : loadError ? (
          <View className="items-start gap-2">
            <Text className="text-red-400 text-sm">{loadError}</Text>
            <Pressable onPress={load} className="bg-surface2 border border-border rounded-lg px-3 py-2">
              <Text className="text-white text-xs font-medium">Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-1.5">
            <Text className="text-gray-400 text-sm">
              {'Versión aceptada: '}
              <Text className="text-white">{consent?.consent_version || 'Sin registro'}</Text>
              {isCurrent ? <Text className="text-primary"> (vigente)</Text> : null}
            </Text>
            <Text className="text-gray-400 text-sm">
              {'Términos y privacidad: '}
              <Text className="text-white">{formatDate(consent?.terms_accepted_at ?? null)}</Text>
            </Text>
            <Text className="text-gray-400 text-sm">
              {'Datos de salud: '}
              <Text className="text-white">{formatDate(consent?.health_data_consent_at ?? null)}</Text>
            </Text>
            {accountEmail ? <Text className="text-gray-500 text-xs mt-1">{'Cuenta: ' + accountEmail}</Text> : null}
          </View>
        )}

        <Text className="text-gray-500 text-xs mt-3 leading-4">
          Puedes conocer, actualizar y rectificar tus datos desde tu perfil. Para revocar tu autorización y suprimir tus
          datos, elimina tu cuenta. Para cualquier otra solicitud, escríbenos.
        </Text>
      </View>

      {/* Documentos y contacto */}
      <View className="bg-surface border border-border rounded-3xl px-4 py-1 mb-4">
        <LinkRow
          icon={<ShieldCheck color="#9ca8a5" size={16} />}
          label="Política de privacidad"
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        />
        <View className="h-px bg-border" />
        <LinkRow
          icon={<FileText color="#9ca8a5" size={16} />}
          label="Términos y condiciones"
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
        />
        <View className="h-px bg-border" />
        <LinkRow
          icon={<Mail color="#9ca8a5" size={16} />}
          label={CONTACT_EMAIL}
          onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        />
      </View>

      {/* Sesion */}
      <Pressable
        onPress={handleSignOut}
        className="bg-surface border border-border rounded-3xl px-4 py-3 mb-6 flex-row items-center gap-3"
        style={{ minHeight: 48 }}
      >
        <LogOut color="#9ca8a5" size={16} />
        <Text className="text-white text-sm font-medium">Cerrar sesión</Text>
      </Pressable>

      {/* Eliminar cuenta */}
      <View className="bg-red-500/5 border border-red-500/30 rounded-3xl p-5">
        <View className="flex-row items-center gap-2 mb-2">
          <Trash2 color="#f87171" size={16} />
          <Text className="text-red-300 font-semibold text-sm">Eliminar mi cuenta</Text>
        </View>
        <Text className="text-gray-400 text-xs leading-4 mb-3">
          Borra de inmediato tu perfil, tus datos de salud, rutinas, entrenamientos, planes de comida, amistades y los
          retos que creaste. Las rutinas que creaste para tus amigos se quedan en su cuenta, sin tu nombre.
        </Text>

        <Text className="text-gray-400 text-xs mb-1">{'Escribe ' + CONFIRM_WORD + ' para confirmar'}</Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          placeholderTextColor="#6b7876"
          editable={!deleting}
          className="bg-surface2 border border-border rounded-lg px-3 py-2.5 text-white mb-3"
        />

        {deleteError ? (
          <View className="bg-red-500/10 rounded-lg p-3 mb-3">
            <Text className="text-red-400 text-sm">No se pudo eliminar la cuenta. Revisa tu conexión e intenta de nuevo.</Text>
            <Text className="text-red-400/70 text-xs mt-1">{deleteError}</Text>
          </View>
        ) : null}

        <GradientButton
          title={deleting ? 'Eliminando...' : 'Eliminar cuenta'}
          onPress={handleDelete}
          disabled={!canDelete}
          loading={deleting}
          colors={['#fb7185', '#dc2626']}
          textColor="#ffffff"
          icon={<Trash2 color="#ffffff" size={17} />}
        />
      </View>
    </ScrollView>
  )
}
