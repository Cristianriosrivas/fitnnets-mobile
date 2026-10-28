import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/tabs'
import GradientFill from './GradientFill'
import { colors } from './theme'

function TabButton({ options, focused, onPress }: { options: BottomTabNavigationOptions; focused: boolean; onPress: () => void }) {
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(active, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 10 }).start()
  }, [focused, active])

  const color = focused ? colors.primary : colors.muted
  const title = typeof options.title === 'string' ? options.title : ''

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={title}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { translateY: active.interpolate({ inputRange: [0, 1], outputRange: [3, -1] }) },
            { scale: active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
          ],
        }}
      >
        {options.tabBarIcon?.({ focused, color, size: 21 })}
      </Animated.View>
      <Animated.Text
        style={{
          color,
          fontSize: 10,
          fontWeight: focused ? '700' : '500',
          marginTop: 3,
          opacity: active.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        }}
      >
        {title}
      </Animated.Text>
    </Pressable>
  )
}

// Barra de pestanas flotante: una pildora con degradado se desliza hacia la pestana activa
export default function AnimatedTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const [width, setWidth] = useState(0)
  const indicator = useRef(new Animated.Value(state.index)).current
  const tabWidth = width / state.routes.length

  useEffect(() => {
    Animated.spring(indicator, { toValue: state.index, useNativeDriver: true, speed: 16, bounciness: 8 }).start()
  }, [state.index, indicator])

  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          height: 64,
          borderRadius: 26,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        {width > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              bottom: 6,
              left: 0,
              width: tabWidth,
              alignItems: 'center',
              transform: [
                {
                  translateX: indicator.interpolate({
                    inputRange: state.routes.map((_, i) => i),
                    outputRange: state.routes.map((_, i) => i * tabWidth),
                  }),
                },
              ],
            }}
          >
            <View style={{ flex: 1, width: tabWidth - 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
              <GradientFill colors={['rgba(34,197,94,0.24)', 'rgba(163,230,53,0.08)']} radius={20} direction="vertical" />
            </View>
          </Animated.View>
        ) : null}

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
