import { useCallback, useEffect, useState } from 'react'
import { Tabs, Redirect } from 'expo-router'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Home, Dumbbell, TrendingUp, Utensils, Users } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { CONSENT_VERSION, consentFromMetadata } from '../../core/legal'

// Orden de los filtros: sesion -> autorizacion vigente -> perfil completo (onboarding)
type Gate = 'checking' | 'error' | 'login' | 'consent' | 'onboarding' | 'ready'

export default function MainLayout() {
  const [gate, setGate] = useState<Gate>('checking')

  const checkAccess = useCallback(async () => {
    setGate('checking')
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) {
      setGate('login')
      return
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('age, goal, consent_version')
      .eq('id', session.user.id)
      .single()

    // Sin perfil no se puede decidir: antes un fallo de red mandaba al onboarding
    if (error || !profile) {
      setGate('error')
      return
    }

    if (profile.consent_version !== CONSENT_VERSION) {
      // Autorizacion dada en el registro que aun no se habia copiado al perfil
      const fromSignUp = consentFromMetadata(session.user)
      if (!fromSignUp) {
        setGate('consent')
        return
      }
      const { error: syncError } = await supabase.from('profiles').update(fromSignUp).eq('id', session.user.id)
      if (syncError) {
        setGate('error')
        return
      }
    }

    setGate(profile.age && profile.goal ? 'ready' : 'onboarding')
  }, [])

  useEffect(() => {
    checkAccess()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) setGate('login')
    })

    return () => listener.subscription.unsubscribe()
  }, [checkAccess])

  if (gate === 'checking') {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    )
  }

  if (gate === 'error') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-base font-semibold text-center">No pudimos cargar tu perfil</Text>
        <Text className="text-gray-400 text-sm text-center mt-1">Revisa tu conexion e intenta de nuevo.</Text>
        <Pressable onPress={checkAccess} className="bg-primary rounded-xl px-6 py-3 mt-5">
          <Text className="text-black font-semibold">Reintentar</Text>
        </Pressable>
        <Pressable onPress={() => supabase.auth.signOut({ scope: 'local' })} className="mt-3 py-2">
          <Text className="text-gray-400 text-sm">Cerrar sesion</Text>
        </Pressable>
      </View>
    )
  }

  if (gate === 'login') {
    return <Redirect href="/(auth)/login" />
  }

  if (gate === 'consent') {
    return <Redirect href="/consent" />
  }

  if (gate === 'onboarding') {
    return <Redirect href="/onboarding" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7876',
        tabBarStyle: {
          backgroundColor: '#0a0f0d',
          borderTopColor: '#2a3532',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="nutricion"
        options={{
          title: 'Nutricion',
          tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="retos" options={{ href: null }} />
      <Tabs.Screen name="rutinas-nueva" options={{ href: null }} />
      <Tabs.Screen name="perfil" options={{ href: null }} />
      <Tabs.Screen name="entrenar/[id]" options={{ href: null }} />
      <Tabs.Screen name="privacidad" options={{ href: null }} />
    </Tabs>
  )
}