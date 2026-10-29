import { useEffect, useId, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg'
import type { LatLng } from '../../core/running'
import { colors } from '../ui/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  route: LatLng[]
  width: number
  height: number
  // En vivo: el punto final late y no hay marca de llegada
  live?: boolean
}

// Dibuja la ruta sin mapas (no necesita claves de Google ni conexión): proyección simple
// lat/lng -> x/y, ajustada al recuadro conservando la forma, con trazo en degradado.
export default function RouteView({ route, width, height, live = false }: Props) {
  const id = 'route' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!live) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [live, pulse])

  const grid = (
    <>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={'h' + f} x1={0} x2={width} y1={height * f} y2={height * f} stroke="#1f2926" strokeWidth={1} strokeDasharray="4 6" />
      ))}
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={'v' + f} y1={0} y2={height} x1={width * f} x2={width * f} stroke="#1f2926" strokeWidth={1} strokeDasharray="4 6" />
      ))}
    </>
  )

  if (route.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          {grid}
        </Svg>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{live ? 'Tu ruta aparecerá aquí al moverte' : 'Ruta no disponible en este teléfono'}</Text>
      </View>
    )
  }

  // Proyección equirectangular: corrige la longitud por la latitud media
  const meanLat = (route.reduce((s, p) => s + p[0], 0) / route.length) * (Math.PI / 180)
  const xs = route.map((p) => p[1] * Math.cos(meanLat))
  const ys = route.map((p) => -p[0])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 18
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  const pts = xs.map((x, i) => [offsetX + (x - minX) * scale, offsetY + (ys[i] - minY) * scale])
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [sx, sy] = pts[0]
  const [ex, ey] = pts[pts.length - 1]

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1={sx} y1={sy} x2={ex} y2={ey} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#22c55e" />
          <Stop offset="0.5" stopColor="#a3e635" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>
      {grid}
      {/* Resplandor bajo la línea */}
      <Path d={d} stroke="#22c55e" strokeOpacity={0.18} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={`url(#${id})`} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={sx} cy={sy} r={6} fill="#22c55e" stroke="#0a0f0d" strokeWidth={2} />
      {live ? (
        <>
          <AnimatedCircle cx={ex} cy={ey} r={pulse.interpolate({ inputRange: [0, 1], outputRange: [8, 16] })} fill="#ffffff" opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] })} />
          <Circle cx={ex} cy={ey} r={6} fill="#ffffff" stroke="#0a0f0d" strokeWidth={2} />
        </>
      ) : (
        <Circle cx={ex} cy={ey} r={6} fill="#f59e0b" stroke="#0a0f0d" strokeWidth={2} />
      )}
    </Svg>
  )
}
