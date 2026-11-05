import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { AiTask, expectedDuration, progressAt, recordDuration, remainingLabel, stageLabel } from '../../core/aiRequest'
import GradientFill from './GradientFill'
import { colors, gradients } from './theme'

// Estado de una generación con IA. run() evita dobles envíos, mide cuánto tardó y deja ver
// la barra llena un momento antes de quitarla; work devuelve true si la generación salió bien.
export function useGeneration(task: AiTask) {
  const [active, setActive] = useState(false)
  const [done, setDone] = useState(false)
  const [expectedMs, setExpectedMs] = useState(30_000)
  const running = useRef(false)

  const run = useCallback(
    async (work: () => Promise<boolean>) => {
      if (running.current) return
      running.current = true
      const started = Date.now()
      setExpectedMs(await expectedDuration(task))
      setActive(true)
      const ok = await work().catch(() => false)
      if (ok) {
        await recordDuration(task, Date.now() - started)
        setDone(true)
        await new Promise((resolve) => setTimeout(resolve, 450))
      }
      setActive(false)
      setDone(false)
      running.current = false
    },
    [task]
  )

  return { task, active, done, expectedMs, run }
}

type Generation = ReturnType<typeof useGeneration>

// Barra de carga con la etapa y el tiempo estimado que falta
export default function GenerationProgress({ generation }: { generation: Generation }) {
  const { task, active, done, expectedMs } = generation
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) return
    const start = Date.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed(Date.now() - start), 250)
    return () => clearInterval(timer)
  }, [active])

  if (!active) return null

  const percent = done ? 100 : progressAt(elapsed, expectedMs)

  return (
    <View className="bg-surface border border-border rounded-3xl p-4 mb-5">
      <View className="flex-row items-center gap-2 mb-2.5">
        <Sparkles color={colors.primary} size={16} />
        <Text className="text-white text-sm font-bold flex-1" numberOfLines={1}>
          {done ? '¡Listo!' : stageLabel(task, percent)}
        </Text>
        <Text className="text-primary text-sm font-extrabold" style={{ fontVariant: ['tabular-nums'] }}>
          {Math.round(percent) + '%'}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Avance de la generación con IA"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        className="h-2.5 rounded-full bg-surface2 overflow-hidden"
      >
        <View style={{ width: `${percent}%`, height: '100%', borderRadius: 999, overflow: 'hidden' }}>
          <GradientFill colors={gradients.brand} direction="horizontal" />
        </View>
      </View>
      <Text className="text-gray-400 text-xs mt-2">{done ? 'Generado con IA' : remainingLabel(elapsed, expectedMs)}</Text>
    </View>
  )
}
