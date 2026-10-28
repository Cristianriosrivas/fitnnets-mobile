import { ActivityIndicator, StyleProp, Text, View, ViewStyle } from 'react-native'
import PressableScale from './PressableScale'
import GradientFill from './GradientFill'
import { glow, gradients, GradientColors } from './theme'

type Props = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  colors?: GradientColors
  textColor?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

// Boton principal: degradado, resplandor de color y rebote al tocarlo
export default function GradientButton({
  title, onPress, disabled, loading, icon, colors = gradients.brand, textColor = '#04120a', style, accessibilityLabel,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={[{ borderRadius: 16 }, glow(colors[0], 18, 0.35), style]}
    >
      <View
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          minHeight: 52,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <GradientFill colors={colors} direction="horizontal" radius={16} />
        {loading ? <ActivityIndicator color={textColor} size="small" /> : icon}
        <Text style={{ color: textColor, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 }}>{title}</Text>
      </View>
    </PressableScale>
  )
}
