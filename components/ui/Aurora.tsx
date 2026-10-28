import { useEffect, useId, useRef } from 'react'
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { colors } from './theme'

type OrbProps = {
  color: string
  size: number
  style?: StyleProp<ViewStyle>
  duration?: number
  drift?: number
  intensity?: number
}

// Esfera de luz difusa que deriva y respira lentamente
export function GlowOrb({ color, size, style, duration = 9000, drift = 26, intensity = 0.5 }: OrbProps) {
  const t = useRef(new Animated.Value(0)).current
  const id = 'o' + useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [duration, t])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size },
        style,
        {
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-drift, drift] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [drift * 0.6, -drift * 0.6] }) },
            { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) },
          ],
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={intensity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={intensity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

// Fondo "aurora": luces de marca que se mueven detras del contenido
export default function Aurora({ height = 420, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: 'hidden' }, style]}>
      <GlowOrb color={colors.primary} size={340} style={{ top: -150, left: -110 }} duration={9000} intensity={0.42} />
      <GlowOrb color={colors.teal} size={280} style={{ top: -60, right: -130 }} duration={11000} drift={32} intensity={0.32} />
      <GlowOrb color={colors.lime} size={220} style={{ top: height * 0.45, left: 40 }} duration={13000} drift={20} intensity={0.16} />
    </View>
  )
}
