import { View } from 'react-native'
import GradientFill from './GradientFill'
import { glow, GradientColors } from './theme'

type Props = {
  colors: GradientColors
  children: React.ReactNode
  size?: number
  radius?: number
  shine?: boolean
}

// Icono sobre un cuadro con degradado y resplandor del mismo color
export default function IconBadge({ colors, children, size = 36, radius = 12, shine = true }: Props) {
  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, shine ? glow(colors[0], 10, 0.4) : null]}>
      <View
        style={{ flex: 1, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      >
        <GradientFill colors={colors} radius={radius} />
        {children}
      </View>
    </View>
  )
}
