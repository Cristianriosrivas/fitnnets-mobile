import { useEffect, useId, useRef } from 'react'
import { Animated } from 'react-native'
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import maleBody from './bodyPaths.json'
import femaleBody from './bodyPathsFemale.json'
import { heatColor, Region } from '../../core/muscles'

export type BodyVariant = 'male' | 'female'
export type BodySide = 'front' | 'back'

type BodyPaths = {
  viewBox: string
  head: { cx: number; cy: number; rx: number; ry: number }
  hair?: string
  neck: string
  silhouetteHalf: string[]
  front: Record<string, string>
  back: Record<string, string>
  frontLines: string[]
  backLines: string[]
}

const BODIES: Record<BodyVariant, BodyPaths> = { male: maleBody as BodyPaths, female: femaleBody as BodyPaths }

export const variantForGender = (gender: string | null | undefined): BodyVariant => (gender === 'femenino' ? 'female' : 'male')

// Las rutas describen la mitad izquierda; la derecha es su reflejo sobre x = 100
const MIRROR = 'translate(200, 0) scale(-1, 1)'
const AnimatedG = Animated.createAnimatedComponent(G)

type Props = {
  variant: BodyVariant
  side: BodySide
  values: Partial<Record<Region, number>>
  width: number
  colorFor?: (region: Region, value: number) => string
  selected?: Region | null
  onSelect?: (region: Region) => void
  // Las zonas más calientes laten
  pulse?: boolean
}

// Cuerpo anatómico vectorial con mapa de calor, sombreado de volumen y músculos tocables
export default function BodyMap({ variant, side, values, width, colorFor, selected, onSelect, pulse = true }: Props) {
  const body = BODIES[variant]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!pulse) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, glow])

  const muscles = Object.entries(body[side]) as [Region, string][]
  const lines = side === 'front' ? body.frontLines : body.backLines
  const hot = muscles.filter(([region]) => (values[region] ?? 0) >= 0.75)
  const silhouette = body.silhouetteHalf.map((d, i) => <Path key={i} d={d} />)
  const headAndNeck = (
    <>
      <Ellipse cx={body.head.cx} cy={body.head.cy} rx={body.head.rx} ry={body.head.ry} />
      <Path d={body.neck} />
    </>
  )

  return (
    <Svg width={width} height={width * 2.2} viewBox={body.viewBox}>
      <Defs>
        <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.14} />
          <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.38} />
        </LinearGradient>
        <ClipPath id={`clip${uid}`}>
          {silhouette}
          <G transform={MIRROR}>{silhouette}</G>
          {headAndNeck}
        </ClipPath>
      </Defs>

      {body.hair ? <Path d={body.hair} fill="#26302d" /> : null}
      <G fill="#1c2523">
        {silhouette}
        <G transform={MIRROR}>{silhouette}</G>
        {headAndNeck}
      </G>

      {muscles.map(([region, d]) => {
        const value = values[region] ?? 0
        const fill = colorFor ? colorFor(region, value) : heatColor(value)
        const isSelected = selected === region
        const common = {
          d,
          fill,
          stroke: isSelected ? '#ffffff' : '#0a0f0d',
          strokeWidth: isSelected ? 2 : 1.2,
          onPress: onSelect ? () => onSelect(region) : undefined,
        }
        return (
          <G key={region}>
            <Path {...common} />
            <Path {...common} transform={MIRROR} />
          </G>
        )
      })}

      {hot.length ? (
        <AnimatedG opacity={glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] })} pointerEvents="none">
          {hot.map(([region, d]) => (
            <G key={region}>
              <Path d={d} fill="#ffffff" />
              <Path d={d} fill="#ffffff" transform={MIRROR} />
            </G>
          ))}
        </AnimatedG>
      ) : null}

      {lines.map((d, i) => (
        <Path key={i} d={d} stroke="#0a0f0d" strokeWidth={1} fill="none" opacity={0.7} />
      ))}

      <Rect x="0" y="0" width="200" height="440" fill={`url(#shade${uid})`} clipPath={`url(#clip${uid})`} pointerEvents="none" />
    </Svg>
  )
}
