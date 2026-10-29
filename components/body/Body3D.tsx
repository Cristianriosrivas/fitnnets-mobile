import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, Text, View } from 'react-native'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'
import { RotateCw } from 'lucide-react-native'
import BodyMap, { BodySide, BodyVariant } from './BodyMap'
import PressableScale from '../ui/PressableScale'
import { colors } from '../ui/theme'
import { Region } from '../../core/muscles'

type Props = {
  variant: BodyVariant
  values: Partial<Record<Region, number>>
  width: number
  colorFor?: (region: Region, value: number) => string
  selected?: Region | null
  onSelect?: (region: Region) => void
  glowColor?: string
  showControls?: boolean
}

const toDeg = { inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] }

// Cuerpo que gira en 3D: se arrastra de lado a lado para ver frente y espalda (con perspectiva),
// se mece solo hasta que lo tocas y se apoya sobre un halo de luz.
export default function Body3D({ variant, values, width, colorFor, selected, onSelect, glowColor = colors.primary, showControls = true }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const height = width * 2.2
  const rotation = useRef(new Animated.Value(0)).current
  const sway = useRef(new Animated.Value(0)).current
  const target = useRef(0)
  const swayLoop = useRef<Animated.CompositeAnimation | null>(null)
  const [side, setSide] = useState<BodySide>('front')

  useEffect(() => {
    swayLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 14, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -14, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    swayLoop.current.start()
    return () => swayLoop.current?.stop()
  }, [sway])

  const settle = (degrees: number) => {
    target.current = degrees
    const normalized = ((degrees % 360) + 360) % 360
    setSide(normalized === 180 ? 'back' : 'front')
    Animated.spring(rotation, { toValue: degrees, useNativeDriver: true, speed: 10, bounciness: 6 }).start()
  }

  const stopSway = () => {
    swayLoop.current?.stop()
    Animated.timing(sway, { toValue: 0, duration: 200, useNativeDriver: true }).start()
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Solo toma el gesto si es horizontal: el desplazamiento vertical sigue siendo de la pantalla
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: stopSway,
        onPanResponderMove: (_, g) => rotation.setValue(target.current + g.dx * 0.9),
        onPanResponderRelease: (_, g) => {
          const current = target.current + g.dx * 0.9
          let snapped = Math.round(current / 180) * 180
          // Un deslizamiento rápido gira al otro lado aunque el arrastre sea corto
          if (snapped === target.current && Math.abs(g.vx) > 0.5) snapped += g.vx > 0 ? 180 : -180
          settle(snapped)
        },
        onPanResponderTerminate: () => settle(target.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const total = Animated.add(rotation, sway)
  const face = (rotate: Animated.AnimatedInterpolation<string>, faceSide: BodySide) => (
    <Animated.View
      pointerEvents={side === faceSide ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        width,
        height,
        backfaceVisibility: 'hidden',
        transform: [{ perspective: 1200 }, { rotateY: rotate }],
      }}
    >
      <BodyMap variant={variant} side={faceSide} values={values} width={width} colorFor={colorFor} selected={selected} onSelect={onSelect} />
    </Animated.View>
  )

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width, height: height + 18 }} {...responder.panHandlers}>
        {/* Halo de luz bajo los pies */}
        <Svg width={width} height={44} style={{ position: 'absolute', bottom: -4 }} pointerEvents="none">
          <Defs>
            <RadialGradient id={`floor${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={glowColor} stopOpacity={0.45} />
              <Stop offset="1" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={width / 2} cy={22} rx={width * 0.42} ry={14} fill={`url(#floor${uid})`} />
        </Svg>
        {face(total.interpolate(toDeg), 'front')}
        {face(Animated.add(total, 180).interpolate(toDeg), 'back')}
      </View>

      {showControls ? (
        <View className="flex-row items-center gap-3 mt-3">
          <Text className="text-gray-400 text-xs font-semibold">{side === 'front' ? 'Frente' : 'Espalda'}</Text>
          <PressableScale onPress={() => { stopSway(); settle(target.current + 180) }} accessibilityLabel="Girar el cuerpo">
            <View className="flex-row items-center gap-1.5 bg-surface2 border border-border rounded-full px-3 py-1.5">
              <RotateCw color={colors.primary} size={13} />
              <Text className="text-white text-xs font-semibold">Girar</Text>
            </View>
          </PressableScale>
          <Text className="text-gray-500 text-[11px]">o arrastra de lado</Text>
        </View>
      ) : null}
    </View>
  )
}
