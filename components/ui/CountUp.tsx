import { useEffect, useState } from 'react'
import { Animated, Easing, StyleProp, Text, TextStyle } from 'react-native'

type Props = {
  value: number
  decimals?: number
  duration?: number
  delay?: number
  prefix?: string
  suffix?: string
  className?: string
  style?: StyleProp<TextStyle>
}

// Numero que cuenta desde 0 hasta su valor
export default function CountUp({ value, decimals = 0, duration = 1000, delay = 0, prefix = '', suffix = '', className, style }: Props) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const animated = new Animated.Value(0)
    const listener = animated.addListener(({ value: current }) => setDisplay(current))
    Animated.timing(animated, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    return () => {
      animated.removeListener(listener)
      animated.stopAnimation()
    }
  }, [value, duration, delay])

  return (
    <Text className={className} style={style}>
      {prefix + display.toFixed(decimals) + suffix}
    </Text>
  )
}
