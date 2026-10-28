import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors } from './theme'

const PALETTE = [colors.primary, colors.lime, colors.teal, colors.gold, colors.orange, colors.violet, colors.sky, colors.rose]

// Explosion de confeti para celebrar (entrenamiento terminado, insignia nueva)
export default function Confetti({ count = 44 }: { count?: number }) {
  const progress = useRef(new Animated.Value(0)).current

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Sale hacia arriba en abanico y luego cae
        const angle = (-160 + Math.random() * 140) * (Math.PI / 180)
        const speed = 140 + Math.random() * 200
        const peak = Math.sin(angle) * speed
        return {
          key: i,
          dx: Math.cos(angle) * speed * 1.2,
          peak,
          fall: peak + 320 + Math.random() * 260,
          size: 6 + Math.random() * 6,
          round: Math.random() > 0.6,
          spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
          color: PALETTE[i % PALETTE.length],
        }
      }),
    [count]
  )

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [progress])

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top: '36%', left: '50%' }}>
        {pieces.map((p) => (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, p.peak, p.fall] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        ))}
      </View>
    </View>
  )
}
