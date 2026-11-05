import { useEffect } from 'react'
import { AppState } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { Home, Dumbbell, TrendingUp, Utensils, Users } from 'lucide-react-native'
import { checkAssignedRoutines, checkNewBadges } from '../../../core/appChecks'
import AnimatedTabBar from '../../../components/ui/AnimatedTabBar'

// Solo las 5 pestanas visibles. Las demas pantallas (perfil, retos, entrenar...) viven en el
// Stack de (main): desde el SDK 58 una pestana con href: null ya no se puede abrir.
export default function TabsLayout() {
  const router = useRouter()
  const lastResponse = Notifications.useLastNotificationResponse()

  // Al abrir la app y cada vez que vuelve al frente: rutinas asignadas e insignias nuevas
  useEffect(() => {
    const runChecks = () => {
      checkAssignedRoutines()
      checkNewBadges()
    }
    runChecks()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runChecks()
    })
    return () => subscription.remove()
  }, [])

  // Tocar una notificacion abre la pantalla que trae en data.url
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url
    if (typeof url === 'string') {
      router.push(url)
      Notifications.clearLastNotificationResponseAsync()
    }
  }, [lastResponse, router])

  return (
    <Tabs tabBar={(props) => <AnimatedTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
          title: 'Nutrición',
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
    </Tabs>
  )
}
