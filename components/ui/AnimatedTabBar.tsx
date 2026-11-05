import { useEffect, useRef } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/tabs'
import GradientFill from './GradientFill'
import { colors, glow, gradients } from './theme'

// Espacio que deben dejar abajo las pestañas: la barra flota sobre el contenido
export const TAB_BAR_SPACE = 120

function TabButton({ options, focused, onPress }: { options: BottomTabNavigationOptions; focused: boolean; onPress: () => void }) {
  const pop = useRef(new Animated.Value(focused ? 1 : 0.8)).current

  useEffect(() => {
    Animated.spring(pop, { toValue: focused ? 1 : 0.8, useNativeDriver: true, speed: 18, bounciness: 10 }).start()
  }, [focused, pop])

  const title = typeof options.title === 'string' ? options.title : ''

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={title}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}
    >
      <View style={{ width: 44, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        {focused ? (
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 14, transform: [{ scale: pop }] }, glow(colors.primary, 10, 0.45)]}>
            <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}>
              <GradientFill colors={gradients.brand} direction="horizontal" radius={14} />
            </View>
          </Animated.View>
        ) : null}
        <View style={{ zIndex: 1 }}>{options.tabBarIcon?.({ focused, color: focused ? '#04120a' : colors.muted, size: 19 })}</View>
      </View>
      <Text style={{ color: focused ? colors.primary : colors.muted, fontSize: 10, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  )
}

// Barra de pestañas flotante, igual a la de la web en el celular
export default function AnimatedTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12 }}>
      <View
        style={{
          flexDirection: 'row',
          height: 64,
          paddingHorizontal: 6,
          borderRadius: 26,
          backgroundColor: 'rgba(20, 27, 25, 0.93)',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {state.routes.map((route, i) => (
          <TabButton
            key={route.key}
            options={descriptors[route.key].options}
            focused={i === state.index}
            onPress={() => navigateToTab(route.key)}
          />
        ))}
      </View>
    </View>
  )
}
