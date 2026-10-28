import { useEffect, useRef } from 'react'
import { Animated, DimensionValue, Easing, StyleProp, ViewStyle } from 'react-native'
import { colors } from './theme'

type Props = {
  height: number
  width?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}

// Bloque que "respira" mientras cargan los datos, en lugar de un texto "Cargando..."
export default function Skeleton({ height, width = '100%', radius = 20, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: colors.surface2,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] }),
        },
        style,
      ]}
    />
  )
}
