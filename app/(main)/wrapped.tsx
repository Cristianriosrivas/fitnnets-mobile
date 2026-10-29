import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, Easing, Share, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { X, Sparkles, Trophy, Share2, Dumbbell } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { WrappedData, cardioEquivalence, loadWrapped, wrappedShareText } from '../../core/wrapped'
import Body3D from '../../components/body/Body3D'
import { BodyVariant, preferredVariant } from '../../components/body/BodyMap'
import GradientFill from '../../components/ui/GradientFill'
import GradientButton from '../../components/ui/GradientButton'
import IconBadge from '../../components/ui/IconBadge'
import CountUp from '../../components/ui/CountUp'
import FadeIn from '../../components/ui/FadeIn'
import Skeleton from '../../components/ui/Skeleton'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, gradients, GradientColors } from '../../components/ui/theme'

const SLIDE_MS = 6000

type Slide = { key: string; colors: GradientColors; glow: string; content: React.ReactNode }

const Kicker = ({ children }: { children: string }) => (
  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', letterSpacing: 3, textAlign: 'center' }}>{children}</Text>
)
const Big = ({ children }: { children: string }) => (
  <Text style={{ color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'center', lineHeight: 40 }}>{children}</Text>
)
const Sub = ({ children }: { children: string }) => (
  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10 }}>{children}</Text>
)
const Chip = ({ children }: { children: string }) => (
  <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>{children}</Text>
  </View>
)

// Barras de historias: las vistas llenas, la actual avanzando, las siguientes vacías
function StoryBars({ count, index, progress }: { count: number; index: number; progress: Animated.Value }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          {i < index ? (
            <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
          ) : i === index ? (
            <Animated.View
              style={{ height: '100%', backgroundColor: '#ffffff', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

export default function WrappedScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [data, setData] = useState<WrappedData | null>(null)
  const [username, setUsername] = useState('')
  const [variant, setVariant] = useState<BodyVariant>('male')
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        const [{ data: profile }, wrapped] = await Promise.all([
          supabase.from('profiles').select('username, gender').eq('id', user.id).single(),
          loadWrapped(user.id),
        ])
        setUsername(profile?.username || '')
        setVariant(await preferredVariant(profile?.gender))
        setData(wrapped)
      } catch {
        setError('No pudimos armar tu resumen. Revisa tu conexión.')
      }
    }
    load()
  }, [])

  const handleShare = () => {
    if (data) Share.share({ message: wrappedShareText(data, username) }).catch(() => undefined)
  }

  const slides: Slide[] = useMemo(() => {
    if (!data) return []
    if (data.workouts === 0) {
      return [
        {
          key: 'vacio',
          colors: ['#052e16', '#14532d', '#0a0f0d'],
          glow: colors.primary,
          content: (
            <>
              <IconBadge colors={gradients.brand} size={72} radius={24}>
                <Dumbbell color="#04120a" size={34} />
              </IconBadge>
              <View style={{ height: 24 }} />
              <Big>Tu Wrapped se arma entrenando</Big>
              <Sub>Completa entrenamientos este mes y vuelve: aquí verás tu resumen para presumir.</Sub>
              <View style={{ height: 28, alignSelf: 'stretch' }} />
              <GradientButton title="Ir a mis rutinas" onPress={() => router.replace('/(main)/(tabs)/rutinas')} style={{ alignSelf: 'stretch' }} />
            </>
          ),
        },
      ]
    }

    const list: Slide[] = [
      {
        key: 'intro',
        colors: ['#052e16', '#14532d', '#0a0f0d'],
        glow: colors.primary,
        content: (
          <>
            <IconBadge colors={gradients.brand} size={76} radius={26}>
              <Sparkles color="#04120a" size={36} />
            </IconBadge>
            <View style={{ height: 26 }} />
            <Kicker>FINNETS WRAPPED</Kicker>
            <View style={{ height: 10 }} />
            <Big>{(username || 'Atleta') + ', este fue tu mes'}</Big>
            <Sub>Tus últimos 30 días, en datos.</Sub>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 40 }}>Toca a la derecha para avanzar →</Text>
          </>
        ),
      },
      {
        key: 'constancia',
        colors: ['#1e1b4b', '#3730a3', '#0a0f0d'],
        glow: colors.violet,
        content: (
          <>
            <Kicker>CONSTANCIA</Kicker>
            <Sub>Entrenaste</Sub>
            <CountUp value={data.workouts} duration={1400} style={{ color: '#ffffff', fontSize: 110, fontWeight: '900', lineHeight: 120 }} />
            <Big>{data.workouts === 1 ? 'día' : 'días'}</Big>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              {data.totalMinutes ? <Chip>{'⏱️ ' + data.totalMinutes + ' min'}</Chip> : null}
              {data.totalSets ? <Chip>{'🏋️ ' + data.totalSets + ' series'}</Chip> : null}
              {data.bestStreak > 1 ? <Chip>{'🔥 ' + data.bestStreak + ' días seguidos'}</Chip> : null}
            </View>
          </>
        ),
      },
    ]

    if (data.volumeKg > 0) {
      list.push({
        key: 'volumen',
        colors: ['#7c2d12', '#c2410c', '#0a0f0d'],
        glow: colors.orange,
        content: (
          <>
            <Kicker>VOLUMEN</Kicker>
            <Sub>En total levantaste</Sub>
            <CountUp value={data.volumeKg} duration={1600} style={{ color: '#ffffff', fontSize: 64, fontWeight: '900', marginTop: 6 }} />
            <Big>kilos</Big>
            <Text style={{ fontSize: 86, marginTop: 22 }}>{data.equivalence.emoji}</Text>
            <Sub>{'Es como levantar ' + data.equivalence.amount + ' ' + data.equivalence.thing}</Sub>
          </>
        ),
      })
    }

    if (data.cardio && data.cardio.km > 0) {
      list.push({
        key: 'cardio',
        colors: ['#4c0519', '#be123c', '#0a0f0d'],
        glow: colors.orange,
        content: (
          <>
            <Kicker>CARDIO</Kicker>
            <Sub>Corriendo y caminando recorriste</Sub>
            <CountUp value={data.cardio.km} decimals={1} duration={1600} style={{ color: '#ffffff', fontSize: 86, fontWeight: '900', lineHeight: 96, marginTop: 6 }} />
            <Big>kilómetros</Big>
            <Text style={{ fontSize: 76, marginTop: 18 }}>🏃</Text>
            <Sub>{cardioEquivalence(data.cardio.km)}</Sub>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 }}>
              <Chip>{data.cardio.outings + (data.cardio.outings === 1 ? ' salida' : ' salidas')}</Chip>
              {data.cardio.minutes ? <Chip>{'⏱️ ' + data.cardio.minutes + ' min'}</Chip> : null}
            </View>
          </>
        ),
      })
    }

    if (data.topMuscle) {
      list.push({
        key: 'musculo',
        colors: ['#083344', '#0e7490', '#0a0f0d'],
        glow: colors.sky,
        content: (
          <>
            <Kicker>TU MÚSCULO ESTRELLA</Kicker>
            <View style={{ height: 14 }} />
            <Body3D variant={variant} values={data.heat} width={Math.min(150, width * 0.38)} glowColor={colors.orange} showControls={false} />
            <View style={{ height: 14 }} />
            <Big>{data.topMuscle.label}</Big>
            <Sub>{Math.round(data.topMuscle.share * 100) + '% de todo lo que entrenaste'}</Sub>
          </>
        ),
      })
    }

    list.push({
      key: 'mejora',
      colors: ['#422006', '#a16207', '#0a0f0d'],
      glow: colors.gold,
      content: data.bestProgress ? (
        <>
          <Kicker>TU MAYOR MEJORA</Kicker>
          <View style={{ height: 14 }} />
          <IconBadge colors={gradients.gold} size={64} radius={22}>
            <Trophy color="#422006" size={30} />
          </IconBadge>
          <View style={{ height: 18 }} />
          <Big>{data.bestProgress.name}</Big>
          <Text style={{ color: '#ffffff', fontSize: 40, fontWeight: '900', marginTop: 12 }}>
            {data.bestProgress.from + ' → ' + data.bestProgress.to + ' kg'}
          </Text>
          <Chip>{'+' + Math.round(((data.bestProgress.to - data.bestProgress.from) / data.bestProgress.from) * 100) + '% en un mes'}</Chip>
        </>
      ) : (
        <>
          <Kicker>TU EJERCICIO FAVORITO</Kicker>
          <View style={{ height: 18 }} />
          <IconBadge colors={gradients.gold} size={64} radius={22}>
            <Dumbbell color="#422006" size={30} />
          </IconBadge>
          <View style={{ height: 18 }} />
          <Big>{data.topExercise?.name || '—'}</Big>
          <Sub>{(data.topExercise?.sets || 0) + ' series completadas'}</Sub>
        </>
      ),
    })

    if (data.timeOfDay) {
      list.push({
        key: 'horario',
        colors: ['#3b0764', '#7e22ce', '#0a0f0d'],
        glow: colors.violet,
        content: (
          <>
            <Kicker>TU PERSONALIDAD</Kicker>
            <Text style={{ fontSize: 96, marginTop: 18 }}>{data.timeOfDay.emoji}</Text>
            <Big>{'Eres un atleta ' + data.timeOfDay.label}</Big>
            <Sub>{'Tu hora favorita para entrenar: ' + data.timeOfDay.hour + ':00'}</Sub>
            {data.weightChange !== null && data.weightChange !== 0 ? (
              <View style={{ marginTop: 20 }}>
                <Chip>{'⚖️ ' + (data.weightChange > 0 ? '+' : '') + data.weightChange + ' kg de peso este mes'}</Chip>
              </View>
            ) : null}
          </>
        ),
      })
    }

    list.push({
      key: 'final',
      colors: ['#052e16', '#166534', '#0a0f0d'],
      glow: colors.lime,
      content: (
        <>
          <Kicker>TU MES EN FINNETS</Kicker>
          <View style={{ height: 12 }} />
          <Big>¡Vas con todo! 💪</Big>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 }}>
            <Chip>{'🗓️ ' + data.workouts + ' días'}</Chip>
            {data.volumeKg ? <Chip>{'🏋️ ' + data.volumeKg + ' kg'}</Chip> : null}
            {data.cardio ? <Chip>{'🏃 ' + String(data.cardio.km).replace('.', ',') + ' km'}</Chip> : null}
            {data.topMuscle ? <Chip>{'⭐ ' + data.topMuscle.label}</Chip> : null}
            {data.bestStreak > 1 ? <Chip>{'🔥 ' + data.bestStreak + ' días seguidos'}</Chip> : null}
          </View>
          <View style={{ height: 30, alignSelf: 'stretch' }} />
          <GradientButton
            title="Compartir mi mes"
            onPress={handleShare}
            icon={<Share2 color="#04120a" size={18} />}
            style={{ alignSelf: 'stretch' }}
          />
          <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Cerrar</Text>
          </Pressable>
        </>
      ),
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, username, variant, width])

  // Cada historia dura SLIDE_MS y pasa sola a la siguiente (la última se queda)
  useEffect(() => {
    if (slides.length === 0) return
    progress.setValue(0)
    const animation = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false })
    animation.start(({ finished }) => {
      if (finished) setIndex((i) => Math.min(i + 1, slides.length - 1))
    })
    return () => animation.stop()
  }, [index, slides.length, progress])

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-gray-400 text-center">{error}</Text>
        <Pressable onPress={() => router.back()} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
          <Text className="text-black font-semibold">Volver</Text>
        </Pressable>
      </View>
    )
  }

  if (!data || slides.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Skeleton height={420} radius={30} />
      </View>
    )
  }

  const slide = slides[Math.min(index, slides.length - 1)]

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={(e) => {
        if (e.nativeEvent.locationX < width * 0.3) setIndex((i) => Math.max(0, i - 1))
        else setIndex((i) => Math.min(slides.length - 1, i + 1))
      }}
      accessibilityHint="Toca a la derecha para avanzar y a la izquierda para volver"
    >
      <View style={{ flex: 1 }}>
        <GradientFill colors={slide.colors} direction="vertical" />
        <GlowOrb key={slide.key + '-glow'} color={slide.glow} size={420} style={{ top: '22%', alignSelf: 'center' }} intensity={0.35} drift={14} />

        <View style={{ paddingTop: 56, paddingHorizontal: 14 }}>
          <StoryBars count={slides.length} index={index} progress={progress} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles color="#ffffff" size={14} />
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Finnets</Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={14} accessibilityLabel="Cerrar resumen">
              <X color="#ffffff" size={22} />
            </Pressable>
          </View>
        </View>

        <FadeIn key={slide.key} distance={26} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 }}>
          {slide.content}
        </FadeIn>
      </View>
    </Pressable>
  )
}
