import { View, Pressable } from 'react-native'
import { Check } from 'lucide-react-native'

type Props = {
  checked: boolean
  onChange: (value: boolean) => void
  accessibilityLabel: string
  children: React.ReactNode
}

// El texto va como children para poder incluir enlaces dentro de la etiqueta
export default function Checkbox({ checked, onChange, accessibilityLabel, children }: Props) {
  return (
    <View className="flex-row items-start gap-3 mb-3">
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
        hitSlop={10}
        className={`w-6 h-6 rounded-md border items-center justify-center mt-0.5 ${
          checked ? 'bg-primary border-primary' : 'bg-surface2 border-border'
        }`}
      >
        {checked ? <Check color="black" size={16} /> : null}
      </Pressable>
      <View className="flex-1">{children}</View>
    </View>
  )
}
