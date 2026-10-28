import { Tabs } from 'expo-router'
import { Home, Dumbbell, TrendingUp, Utensils, Users } from 'lucide-react-native'

// Solo las 5 pestanas visibles. Las demas pantallas (perfil, retos, entrenar...) viven en el
// Stack de (main): desde el SDK 58 una pestana con href: null ya no se puede abrir.
export default function TabsLayout() {
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
    </Tabs>
  )
}
