import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native'

type Props = {
  children: React.ReactNode
  delay?: number
  distance?: number
  style?: StyleProp<ViewStyle>
}

// Entrada suave: aparece subiendo un poco. Con delay distinto por elemento se logra el efecto cascada.
export default function FadeIn({ children, delay = 0, distance = 18, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [delay, progress])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
