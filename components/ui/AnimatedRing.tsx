import { useEffect, useId, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { gradients, GradientColors } from './theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  progress: number // 0-100
  size?: number
  stroke?: number
  colors?: GradientColors
  trackColor?: string
  duration?: number
  delay?: number
  // Valor inicial del anillo (100 para un cronometro que se vacia)
  from?: number
  linear?: boolean
  children?: React.ReactNode
}

// Anillo de progreso con trazo en degradado que se llena animado
export default function AnimatedRing({
  progress, size = 96, stroke = 10, colors = gradients.brand, trackColor = '#1f2926',
  duration = 1100, delay = 0, from = 0, linear = false, children,
}: Props) {
  const id = 'r' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = useRef(new Animated.Value(from)).current

  useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: Math.max(0, Math.min(100, progress)),
      duration,
      delay,
      easing: linear ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [progress, duration, delay, linear, value])

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {colors.map((c, i) => (
              <Stop key={c + i} offset={String(i / (colors.length - 1))} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={value.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  )
}
