import { useRef } from 'react'
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native'

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  scaleTo?: number
}

// Boton que se "hunde" con un resorte al tocarlo. Los estilos de NativeWind van en los hijos.
export default function PressableScale({ children, style, scaleTo = 0.96, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 8 : 0 }).start()

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        springTo(scaleTo)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        springTo(1)
        onPressOut?.(e)
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.5 } : null]}>{children}</Animated.View>
    </Pressable>
  )
}
