import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, Switch, ActivityIndicator, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Bell, Dumbbell, Scale, Minus, Plus, Check } from 'lucide-react-native'
import {
  applyReminders, ensureNotificationPermission, loadReminders, notifyNow, ReminderSettings, DEFAULT_REMINDERS,
} from '../../core/notifications'
import FadeIn from '../../components/ui/FadeIn'
import GradientButton from '../../components/ui/GradientButton'
import IconBadge from '../../components/ui/IconBadge'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, gradients } from '../../components/ui/theme'

// 1 = domingo ... 7 = sabado (formato de expo-notifications), mostrados de lunes a domingo
const WEEKDAYS = [
  { value: 2, label: 'L' }, { value: 3, label: 'M' }, { value: 4, label: 'M' }, { value: 5, label: 'J' },
  { value: 6, label: 'V' }, { value: 7, label: 'S' }, { value: 1, label: 'D' },
]

const pad = (n: number) => String(n).padStart(2, '0')

function StepButton({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-11 h-11 rounded-xl bg-surface2 border border-border items-center justify-center"
    >
      {children}
    </Pressable>
  )
}

function TimeStepper({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const shift = (minutes: number) => {
    const total = (hour * 60 + minute + minutes + 24 * 60) % (24 * 60)
    onChange(Math.floor(total / 60), total % 60)
  }
  return (
    <View className="flex-row items-center gap-3">
      <StepButton onPress={() => shift(-30)} label="Media hora antes">
        <Minus color="#9ca8a5" size={16} />
      </StepButton>
      <Text className="text-white text-2xl font-bold w-24 text-center">{pad(hour) + ':' + pad(minute)}</Text>
      <StepButton onPress={() => shift(30)} label="Media hora después">
        <Plus color="#9ca8a5" size={16} />
      </StepButton>
    </View>
  )
}

function WeekdayChips({ selected, onToggle }: { selected: number[]; onToggle: (weekday: number) => void }) {
  return (
    <View className="flex-row justify-between">
      {WEEKDAYS.map((d) => {
        const active = selected.includes(d.value)
        return (
          <Pressable
            key={d.value}
            onPress={() => onToggle(d.value)}
            className={`w-10 h-10 rounded-full border items-center justify-center ${
              active ? 'bg-primary border-primary' : 'bg-surface2 border-border'
            }`}
          >
            <Text className={active ? 'text-black font-semibold' : 'text-gray-400'}>{d.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ReminderCard({
  icon, title, subtitle, enabled, onToggle, children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  enabled: boolean
  onToggle: (value: boolean) => void
  children: React.ReactNode
}) {
  return (
    <View className="bg-surface border border-border rounded-3xl p-4 mb-4">
      <View className="flex-row items-center gap-3">
        <IconBadge colors={gradients.brand} size={38} radius={12}>
          {icon}
        </IconBadge>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">{title}</Text>
          <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#2a3532', true: '#22c55e' }}
          thumbColor="#ffffff"
          accessibilityLabel={title}
        />
      </View>
      {enabled ? <View className="mt-4 gap-4">{children}</View> : null}
    </View>
  )
}

export default function RecordatoriosScreen() {
  const router = useRouter()
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    loadReminders().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const update = (next: ReminderSettings) => {
    setSettings(next)
    setSaved(false)
  }

  const toggleTrainDay = (weekday: number) => {
    const days = settings.train.weekdays
    const weekdays = days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday]
    update({ ...settings, train: { ...settings.train, weekdays } })
  }

  const handleSave = async () => {
    setError('')
    setPermissionDenied(false)
    if (settings.train.enabled && settings.train.weekdays.length === 0) {
      setError('Elige al menos un día para el recordatorio de entrenar.')
      return
    }
    setSaving(true)
    try {
      if (settings.train.enabled || settings.weight.enabled) {
        const granted = await ensureNotificationPermission()
        if (!granted) {
          setPermissionDenied(true)
          setSaving(false)
          return
        }
      }
      await applyReminders(settings)
      setSaved(true)
    } catch {
      setError('No se pudieron programar los recordatorios. Intenta de nuevo.')
    }
    setSaving(false)
  }

  const handleTest = async () => {
    setError('')
    const granted = await ensureNotificationPermission()
    if (!granted) {
      setPermissionDenied(true)
      return
    }
    await notifyNow('Así se verán tus recordatorios 🔔', 'Las notificaciones de Finnets están funcionando.')
  }

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <GlowOrb color={colors.primary} size={340} style={{ top: -170, left: -130 }} intensity={0.26} />
      <FadeIn>
        <View className="flex-row items-end gap-3 mb-2">
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-1.5">
            <ArrowLeft color={colors.soft} size={22} />
          </Pressable>
          <View>
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              Constancia en piloto automático
            </Text>
            <Text className="text-white text-3xl font-extrabold mt-1">Recordatorios</Text>
          </View>
        </View>
        <Text className="text-gray-400 text-sm mb-5">
          Se programan en este teléfono y llegan aunque la app esté cerrada.
        </Text>
      </FadeIn>

      <ReminderCard
        icon={<Dumbbell color="#04120a" size={18} />}
        title="Recordarme entrenar"
        subtitle="Los días y la hora que elijas"
        enabled={settings.train.enabled}
        onToggle={(enabled) => update({ ...settings, train: { ...settings.train, enabled } })}
      >
        <WeekdayChips selected={settings.train.weekdays} onToggle={toggleTrainDay} />
        <TimeStepper
          hour={settings.train.hour}
          minute={settings.train.minute}
          onChange={(hour, minute) => update({ ...settings, train: { ...settings.train, hour, minute } })}
        />
      </ReminderCard>

      <ReminderCard
        icon={<Scale color="#04120a" size={18} />}
        title="Recordarme registrar mi peso"
        subtitle="Una vez por semana"
        enabled={settings.weight.enabled}
        onToggle={(enabled) => update({ ...settings, weight: { ...settings.weight, enabled } })}
      >
        <WeekdayChips
          selected={[settings.weight.weekday]}
          onToggle={(weekday) => update({ ...settings, weight: { ...settings.weight, weekday } })}
        />
        <TimeStepper
          hour={settings.weight.hour}
          minute={settings.weight.minute}
          onChange={(hour, minute) => update({ ...settings, weight: { ...settings.weight, hour, minute } })}
        />
      </ReminderCard>

      <View className="bg-surface border border-border rounded-2xl p-4 mb-5 flex-row gap-3">
        <Bell color="#60a5fa" size={18} />
        <Text className="text-gray-400 text-xs leading-5 flex-1">
          Cuando un amigo te asigne una rutina o desbloquees una insignia, te avisamos al abrir la app.
        </Text>
      </View>

      {permissionDenied ? (
        <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
          <Text className="text-red-400 text-sm">
            Las notificaciones de Finnets están desactivadas. Actívalas en los ajustes del teléfono.
          </Text>
          <Pressable onPress={() => Linking.openSettings()} className="mt-2 self-start">
            <Text className="text-primary text-sm font-semibold">Abrir ajustes</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

      <GradientButton
        title={saving ? 'Guardando...' : saved ? 'Recordatorios guardados' : 'Guardar recordatorios'}
        onPress={handleSave}
        loading={saving}
        icon={saved ? <Check color="#04120a" size={18} strokeWidth={3} /> : <Bell color="#04120a" size={17} />}
      />

      <Pressable onPress={handleTest} className="mt-4 py-2 items-center">
        <Text className="text-gray-400 text-sm">Enviar una notificación de prueba</Text>
      </Pressable>
    </ScrollView>
  )
}
