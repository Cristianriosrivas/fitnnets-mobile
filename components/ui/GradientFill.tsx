import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import type { GradientColors } from './theme'

type Props = {
  colors: GradientColors
  radius?: number
  // 'diagonal' va de arriba-izquierda a abajo-derecha
  direction?: 'horizontal' | 'vertical' | 'diagonal'
  opacity?: number
}

// Capa de degradado que llena a su padre (que debe tener overflow hidden o el mismo radio)
export default function GradientFill({ colors, radius = 0, direction = 'diagonal', opacity = 1 }: Props) {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const end = direction === 'horizontal' ? { x2: '1', y2: '0' } : direction === 'vertical' ? { x2: '0', y2: '1' } : { x2: '1', y2: '1' }
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" {...end}>
          {colors.map((c, i) => (
            <Stop key={c + i} offset={String(i / (colors.length - 1))} stopColor={c} stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  )
}
