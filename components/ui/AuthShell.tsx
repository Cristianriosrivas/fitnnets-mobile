import { useState } from 'react'
import { View, Text, TextInput, TextInputProps, Pressable, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { Dumbbell, Eye, EyeOff } from 'lucide-react-native'
import Aurora from './Aurora'
import FadeIn from './FadeIn'
import TiltCard from './TiltCard'
import GradientFill from './GradientFill'
import { colors, glow, gradients } from './theme'

// Textos solo ASCII: se usan en login y registro

type FieldProps = Omit<TextInputProps, 'className'> & {
  label: string
  icon: React.ReactNode
  secret?: boolean
}

// Campo con icono, borde verde al enfocarlo y, si es secreto, boton para ver la contrasena
export function AuthField({ label, icon, secret, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">{label}</Text>
      <View
        className="flex-row items-center rounded-2xl px-3.5"
        style={{
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.border,
          minHeight: 52,
        }}
      >
        {icon}
        <TextInput
          {...input}
          secureTextEntry={secret && !visible}
          placeholderTextColor={colors.muted}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          style={{ flex: 1, color: colors.text, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15 }}
        />
        {secret ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={12}
            accessibilityLabel={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {visible ? <EyeOff color={colors.muted} size={18} /> : <Eye color={colors.muted} size={18} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

// Marco de las pantallas de acceso: aurora animada, logo 3D flotante y tarjeta de vidrio
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { height } = useWindowDimensions()
  return (
    <View className="flex-1 bg-background">
      <Aurora height={height} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn style={{ alignItems: 'center', marginBottom: 26 }}>
            <TiltCard float radius={26} maxTilt={14} style={glow(colors.primary, 26, 0.55)}>
              <View style={{ width: 76, height: 76, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <GradientFill colors={gradients.brand} radius={26} />
                <Dumbbell color="#04120a" size={36} strokeWidth={2.4} />
              </View>
            </TiltCard>
            <Text className="text-white text-2xl font-extrabold mt-5" style={{ letterSpacing: 8 }}>
              FINNETS
            </Text>
          </FadeIn>

          <FadeIn delay={140}>
            <View
              className="rounded-3xl p-6"
              style={{ backgroundColor: 'rgba(20,27,25,0.86)', borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-white text-2xl font-extrabold">{title}</Text>
              <Text className="text-gray-400 text-sm mt-1 mb-6">{subtitle}</Text>
              {children}
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

// Boton secundario "Continuar con Google" con la G de colores
export function GoogleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center justify-center gap-3 rounded-2xl"
      style={{ minHeight: 52, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}
    >
      <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
        <Text style={{ color: '#4285F4', fontWeight: '900', fontSize: 14 }}>G</Text>
      </View>
      <Text className="text-white font-semibold">Continuar con Google</Text>
    </Pressable>
  )
}

export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3 my-5">
      <View className="flex-1 h-px bg-border" />
      <Text className="text-gray-500 text-xs">o</Text>
      <View className="flex-1 h-px bg-border" />
    </View>
  )
}
