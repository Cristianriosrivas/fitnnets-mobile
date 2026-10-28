import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, GestureResponderEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import GradientFill from './GradientFill'

type Props = {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  radius?: number
  maxTilt?: number
  // Flota y se mece despacio, como si estuviera suspendida
  float?: boolean
  // Un brillo diagonal la recorre cada pocos segundos (efecto holografico)
  glare?: boolean
  accessibilityLabel?: string
}

const spring = (value: Animated.Value, toValue: number) =>
  Animated.spring(value, { toValue, useNativeDriver: true, speed: 22, bounciness: 6 })

// Tarjeta 3D: al tocarla se inclina hacia el punto donde esta el dedo y se hunde un poco.
export default function TiltCard({
  children, onPress, style, radius = 24, maxTilt = 9, float = false, glare = false, accessibilityLabel,
}: Props) {
  const tiltX = useRef(new Animated.Value(0)).current
  const tiltY = useRef(new Animated.Value(0)).current
  const press = useRef(new Animated.Value(0)).current
  const floatValue = useRef(new Animated.Value(0.5)).current
  const glareValue = useRef(new Animated.Value(0)).current
  const size = useRef({ width: 1, height: 1 })
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!float) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatValue, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [float, floatValue])

  useEffect(() => {
    if (!glare) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(glareValue, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glareValue, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [glare, glareValue])

  const handlePressIn = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent
    const nx = Math.max(-1, Math.min(1, (locationX / size.current.width) * 2 - 1))
    const ny = Math.max(-1, Math.min(1, (locationY / size.current.height) * 2 - 1))
    Animated.parallel([spring(tiltX, -ny), spring(tiltY, nx), spring(press, 1)]).start()
  }

  const handlePressOut = () => {
    Animated.parallel([spring(tiltX, 0), spring(tiltY, 0), spring(press, 0)]).start()
  }

  const sway = float ? 0.18 : 0
  const toDeg = { inputRange: [-1.5, 1.5], outputRange: [`-${maxTilt * 1.5}deg`, `${maxTilt * 1.5}deg`] }
  const rotateX = Animated.add(tiltX, floatValue.interpolate({ inputRange: [0, 1], outputRange: [-sway, sway] })).interpolate(toDeg)
  const rotateY = Animated.add(tiltY, floatValue.interpolate({ inputRange: [0, 1], outputRange: [sway, -sway] })).interpolate(toDeg)
  const translateY = floatValue.interpolate({ inputRange: [0, 1], outputRange: float ? [2, -4] : [0, 0] })
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] })

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        onLayout={(e) => {
          size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
          setWidth(e.nativeEvent.layout.width)
        }}
        style={[
          style,
          { borderRadius: radius, transform: [{ perspective: 900 }, { translateY }, { rotateX }, { rotateY }, { scale }] },
        ]}
      >
        {children}
        {glare && width > 0 ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
            <Animated.View
              style={{
                position: 'absolute',
                top: -60,
                bottom: -60,
                width: 110,
                transform: [
                  { translateX: glareValue.interpolate({ inputRange: [0, 1], outputRange: [-160, width + 60] }) },
                  { rotate: '20deg' },
                ],
              }}
            >
              <GradientFill
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                direction="horizontal"
              />
            </Animated.View>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}
