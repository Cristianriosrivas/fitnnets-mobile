import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Animated, useWindowDimensions } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ArrowLeft, Users, Lock, Ruler, Dumbbell, Swords, BatteryCharging } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import {
  ALL_REGIONS, MapMode, MuscleProfile, Region, RegionTier, TIER_COLOR, TIER_ORDER, buildMuscleProfile,
  compareProfiles, heatColor, loadFriendExerciseStats, loadOwnExerciseStats, loadSizeChanges, regionValues, tierFor,
} from '../../core/muscles'
import Body3D from '../../components/body/Body3D'
import { BODY_VARIANT_KEY, BodyVariant, variantForGender } from '../../components/body/BodyMap'
import { RecoveryMap, RegionRecovery, computeRecovery, loadRecentLogs, recoveryColor } from '../../core/recovery'
import FadeIn from '../../components/ui/FadeIn'
import PressableScale from '../../components/ui/PressableScale'
import GradientFill from '../../components/ui/GradientFill'
import AnimatedRing from '../../components/ui/AnimatedRing'
import CountUp from '../../components/ui/CountUp'
import Skeleton from '../../components/ui/Skeleton'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, gradients, GradientColors } from '../../components/ui/theme'

// Además de los modos del mapa muscular, tu cuerpo tiene "Recuperación" (solo en tu propio mapa)
type ViewMode = MapMode | 'recuperacion'

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'volumen', label: 'Volumen' },
  { value: 'progreso', label: 'Progreso' },
  { value: 'rango', label: 'Rango' },
  { value: 'recuperacion', label: 'Recuperación' },
]
const FRIEND_MODES = MODES.filter((m) => m.value !== 'recuperacion')

const MODE_HINT: Record<ViewMode, string> = {
  volumen: 'Lo que más entrenas (últimos 30 días)',
  progreso: 'Dónde subiste peso o ganaste centímetros',
  rango: 'El nivel de cada músculo, de Bronce a Diamante',
  recuperacion: 'Verde = listo para entrenar · rojo = necesita descanso',
}

const RECOVERY_LEGEND: GradientColors = ['#ef4444', '#f59e0b', '#facc15', '#a3e635', '#22c55e']

const HEAT_LEGEND: GradientColors = ['#2a3532', '#14b8a6', '#22c55e', '#a3e635', '#f59e0b', '#ef4444']

const tierColorFor = (_region: Region, value: number) => TIER_COLOR[tierFor(value * 100)]

function TierChip({ tier, small }: { tier: RegionTier; small?: boolean }) {
  return (
    <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: TIER_COLOR[tier] + '26', borderWidth: 1, borderColor: TIER_COLOR[tier] + '66' }}>
      <Text style={{ color: tier === 'Sin entrenar' ? colors.muted : TIER_COLOR[tier], fontSize: small ? 10 : 11, fontWeight: '800' }}>{tier}</Text>
    </View>
  )
}

// Selector de modo con una píldora que se desliza
function ModeSwitch({ modes, mode, onChange }: { modes: { value: ViewMode; label: string }[]; mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const [width, setWidth] = useState(0)
  const index = Math.max(0, modes.findIndex((m) => m.value === mode))
  const pos = useRef(new Animated.Value(index)).current
  useEffect(() => {
    Animated.spring(pos, { toValue: index, useNativeDriver: true, speed: 16, bounciness: 8 }).start()
  }, [index, pos])
  // Ancho útil = ancho total menos borde (2) y relleno (8)
  const segment = (width - 10) / modes.length
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row bg-surface border border-border rounded-2xl p-1"
      style={{ height: 46 }}
    >
      {width > 0 ? (
        <Animated.View
          style={{
            position: 'absolute', top: 3, bottom: 3, left: 3, width: segment, borderRadius: 12, overflow: 'hidden',
            transform: [{ translateX: pos.interpolate({ inputRange: modes.map((_, i) => i), outputRange: modes.map((_, i) => i * segment) }) }],
          }}
        >
          <GradientFill colors={gradients.brand} direction="horizontal" />
        </Animated.View>
      ) : null}
      {modes.map((m) => {
        const active = m.value === mode
        return (
          <Pressable key={m.value} onPress={() => onChange(m.value)} className="flex-1 items-center justify-center" accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Text numberOfLines={1} style={{ color: active ? '#04120a' : colors.soft, fontWeight: active ? '800' : '600', fontSize: modes.length > 3 ? 12 : 13 }}>
              {m.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Legend({ mode }: { mode: ViewMode }) {
  if (mode === 'recuperacion') {
    return (
      <View className="mt-4 px-6">
        <View className="h-2 rounded-full overflow-hidden">
          <GradientFill colors={RECOVERY_LEGEND} direction="horizontal" />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-gray-500 text-[11px]">Cansado</Text>
          <Text className="text-gray-500 text-[11px]">Recuperado</Text>
        </View>
      </View>
    )
  }
  if (mode === 'rango') {
    return (
      <View className="flex-row flex-wrap justify-center gap-1.5 mt-4">
        {TIER_ORDER.slice(1).map((t) => (
          <TierChip key={t} tier={t} small />
        ))}
      </View>
    )
  }
  return (
    <View className="mt-4 px-6">
      <View className="h-2 rounded-full overflow-hidden">
        <GradientFill colors={HEAT_LEGEND} direction="horizontal" />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-gray-500 text-[11px]">{mode === 'progreso' ? 'Sin cambio' : 'Poco'}</Text>
        <Text className="text-gray-500 text-[11px]">{mode === 'progreso' ? 'Gran mejora' : 'Mucho'}</Text>
      </View>
    </View>
  )
}

function RegionDetail({ profile, region, recovery }: { profile: MuscleProfile; region: Region; recovery?: RegionRecovery }) {
  const r = profile.regions[region]
  return (
    <View className="bg-surface border border-border rounded-3xl p-4 mt-5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-extrabold text-lg">{r.label}</Text>
        <TierChip tier={r.tier} />
      </View>
      {recovery ? (
        <View className="flex-row items-center gap-2 rounded-xl px-3 py-2.5 mb-2" style={{ backgroundColor: recoveryColor(recovery.recovery) + '1f' }}>
          <BatteryCharging color={recoveryColor(recovery.recovery)} size={16} />
          <Text className="text-white text-sm font-semibold flex-1">
            {Math.round(recovery.recovery * 100) + '% recuperado' + (recovery.hoursToFull ? ' · listo en ' + recovery.hoursToFull + ' h' : ' · listo para entrenar')}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <View className="bg-surface2 rounded-xl px-3 py-2">
          <Text className="text-gray-500 text-[11px]">Series (30 días)</Text>
          <Text className="text-white font-bold">{Math.round(r.recent)}</Text>
        </View>
        <View className="bg-surface2 rounded-xl px-3 py-2">
          <Text className="text-gray-500 text-[11px]">Series totales</Text>
          <Text className="text-white font-bold">{Math.round(r.volume)}</Text>
        </View>
        <View className="bg-surface2 rounded-xl px-3 py-2">
          <Text className="text-gray-500 text-[11px]">Fuerza</Text>
          <Text className={`font-bold ${r.strength && r.strength > 0 ? 'text-primary' : 'text-white'}`}>
            {r.strength === null ? '—' : (r.strength > 0 ? '+' : '') + Math.round(r.strength * 100) + '%'}
          </Text>
        </View>
        {r.size ? (
          <View className="bg-surface2 rounded-xl px-3 py-2">
            <Text className="text-gray-500 text-[11px]">{r.size.label}</Text>
            <Text className="text-white font-bold">{(r.size.delta > 0 ? '+' : '') + r.size.delta + ' cm'}</Text>
          </View>
        ) : null}
      </View>
      {r.topExercise ? (
        <View className="flex-row items-center gap-2 mt-3">
          <Dumbbell color={colors.primary} size={14} />
          <Text className="text-gray-400 text-xs">{'Tu ejercicio principal: ' + r.topExercise}</Text>
        </View>
      ) : (
        <Text className="text-gray-500 text-xs mt-3">Todavía no entrenas este músculo. Agrega un ejercicio a tu rutina.</Text>
      )}
    </View>
  )
}

export default function CuerpoScreen() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const params = useLocalSearchParams<{ friendId?: string; friendName?: string; mode?: string }>()
  const friendId = typeof params.friendId === 'string' ? params.friendId : undefined
  const friendName = typeof params.friendName === 'string' ? params.friendName : 'tu amigo'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<ViewMode>(params.mode === 'recuperacion' && !friendId ? 'recuperacion' : 'volumen')
  const [recoveryMap, setRecoveryMap] = useState<RecoveryMap | null>(null)
  const [selected, setSelected] = useState<Region | null>(null)
  const [variant, setVariant] = useState<BodyVariant>('male')
  const [mine, setMine] = useState<MuscleProfile | null>(null)
  const [sharing, setSharing] = useState<boolean | null>(null)
  const [friends, setFriends] = useState<{ id: string; username: string }[]>([])
  const [theirs, setTheirs] = useState<MuscleProfile | null>(null)
  const [theirVariant, setTheirVariant] = useState<BodyVariant>('male')
  const [friendStatus, setFriendStatus] = useState<'ok' | 'not_shared' | 'not_friends' | 'unavailable' | 'error' | null>(null)

  const load = useCallback(async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const [stats, sizes, savedVariant, recentLogs] = await Promise.all([
        loadOwnExerciseStats(user.id, !friendId),
        loadSizeChanges(user.id),
        AsyncStorage.getItem(BODY_VARIANT_KEY).catch(() => null),
        loadRecentLogs(user.id).catch(() => []),
      ])
      const profile = buildMuscleProfile(stats, sizes)
      setMine(profile)
      setRecoveryMap(computeRecovery(recentLogs))
      setSelected((current) => current ?? (profile.ranked[0]?.score ? profile.ranked[0].region : 'chest'))

      // share_muscle_map existe desde la migración del mapa muscular
      let me = await supabase.from('profiles').select('gender, share_muscle_map').eq('id', user.id).single()
      if (me.error) me = await supabase.from('profiles').select('gender').eq('id', user.id).single()
      const myRow = me.data as { gender?: string | null; share_muscle_map?: boolean } | null
      setVariant(savedVariant === 'male' || savedVariant === 'female' ? savedVariant : variantForGender(myRow?.gender))
      setSharing(myRow && 'share_muscle_map' in myRow ? !!myRow.share_muscle_map : null)

      if (friendId) {
        const [result, friendProfile] = await Promise.all([
          loadFriendExerciseStats(friendId),
          supabase.from('profiles').select('gender').eq('id', friendId).maybeSingle(),
        ])
        setTheirVariant(variantForGender(friendProfile.data?.gender))
        setFriendStatus(result.status)
        setTheirs(result.status === 'ok' ? buildMuscleProfile(result.stats) : null)
      } else {
        const [{ data: sent }, { data: received }] = await Promise.all([
          supabase.from('friendships').select('profiles!friendships_friend_id_fkey(id, username)').eq('user_id', user.id).eq('status', 'aceptado'),
          supabase.from('friendships').select('profiles!friendships_user_id_fkey(id, username)').eq('friend_id', user.id).eq('status', 'aceptado'),
        ])
        setFriends(
          [...(sent || []), ...(received || [])]
            .map((f: any) => f.profiles)
            .filter((p: any) => p?.id)
            .map((p: any) => ({ id: p.id, username: p.username }))
        )
      }
    } catch {
      setError('No pudimos cargar tu mapa muscular. Revisa tu conexión.')
    }
    setLoading(false)
  }, [friendId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const changeVariant = (v: BodyVariant) => {
    setVariant(v)
    AsyncStorage.setItem(BODY_VARIANT_KEY, v).catch(() => undefined)
  }

  // Los modos del mapa muscular; en "Recuperación" los valores salen del mapa de recuperación
  const mapMode: MapMode = mode === 'recuperacion' ? 'volumen' : mode
  const colorFor =
    mode === 'rango' ? tierColorFor : mode === 'recuperacion' ? (_region: Region, value: number) => recoveryColor(value) : undefined
  const glowFor = (profile: MuscleProfile) => (mode === 'rango' ? TIER_COLOR[profile.overallTier] : mode === 'progreso' ? colors.lime : colors.primary)

  const header = (
    <View className="flex-row items-end gap-3 mb-5">
      <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-1.5">
        <ArrowLeft color={colors.soft} size={22} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
          {friendId ? 'Comparación' : 'Mapa muscular'}
        </Text>
        <Text className="text-white text-3xl font-extrabold mt-1" numberOfLines={1}>
          {friendId ? 'Tú vs ' + friendName : 'Tu cuerpo'}
        </Text>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center px-4" style={{ paddingTop: 70 }}>
        <Skeleton height={46} radius={16} />
        <Skeleton height={480} width={220} radius={110} style={{ marginTop: 24 }} />
      </View>
    )
  }

  if (error || !mine) {
    return (
      <View className="flex-1 bg-background px-4" style={{ paddingTop: 60 }}>
        {header}
        <View className="bg-surface border border-border rounded-3xl p-6 items-center">
          <Text className="text-gray-400 text-center">{error || 'Sin datos.'}</Text>
          <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
            <Text className="text-black font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // ----- Comparación con un amigo -----
  if (friendId) {
    const bodyWidth = Math.min(170, (screenWidth - 32 - 12) / 2)
    const comparison = theirs ? compareProfiles(mine, theirs) : null
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <GlowOrb color={colors.sky} size={360} style={{ top: -160, right: -140 }} intensity={0.22} />
        <FadeIn>{header}</FadeIn>

        {friendStatus !== 'ok' || !theirs ? (
          <FadeIn delay={80}>
            <View className="bg-surface border border-border rounded-3xl p-6 items-center">
              <View className="w-14 h-14 rounded-2xl bg-surface2 items-center justify-center mb-3">
                <Lock color={colors.muted} size={24} />
              </View>
              <Text className="text-white font-bold text-base text-center">
                {friendStatus === 'not_shared'
                  ? friendName + ' aún no comparte su mapa'
                  : friendStatus === 'unavailable'
                    ? 'Comparación aún no disponible'
                    : 'No pudimos cargar la comparación'}
              </Text>
              <Text className="text-gray-400 text-sm text-center mt-1 leading-5">
                {friendStatus === 'not_shared'
                  ? 'Pídele que lo active en Perfil → Privacidad y cuenta → Compartir mi mapa muscular.'
                  : friendStatus === 'unavailable'
                    ? 'Falta aplicar la actualización de la base de datos del mapa muscular.'
                    : friendStatus === 'not_friends'
                      ? 'Solo puedes comparar con amigos aceptados.'
                      : 'Revisa tu conexión e intenta de nuevo.'}
              </Text>
              {friendStatus === 'error' ? (
                <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
                  <Text className="text-black font-semibold">Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          </FadeIn>
        ) : (
          <>
            <FadeIn delay={60}>
              <ModeSwitch modes={FRIEND_MODES} mode={mode} onChange={setMode} />
              <Text className="text-gray-500 text-xs text-center mt-2">{MODE_HINT[mode]}</Text>
            </FadeIn>

            <FadeIn delay={120}>
              <View className="flex-row justify-between mt-5">
                {[
                  { label: 'Tú', profile: mine, v: variant },
                  { label: friendName, profile: theirs, v: theirVariant },
                ].map((side) => (
                  <View key={side.label} className="items-center" style={{ width: bodyWidth }}>
                    <Body3D
                      variant={side.v}
                      values={regionValues(side.profile, mapMode)}
                      width={bodyWidth}
                      colorFor={colorFor}
                      glowColor={glowFor(side.profile)}
                      showControls={false}
                    />
                    <Text className="text-white font-bold mt-3" numberOfLines={1}>{side.label}</Text>
                    <View className="flex-row items-center gap-1.5 mt-1">
                      <TierChip tier={side.profile.overallTier} small />
                      <Text className="text-gray-400 text-xs">{side.profile.overallScore + ' pts'}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text className="text-gray-500 text-[11px] text-center mt-3">Arrastra cada cuerpo de lado para verlo de espalda</Text>
            </FadeIn>

            {comparison ? (
              <FadeIn delay={200}>
                <View className="bg-surface border border-border rounded-3xl p-5 mt-5">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Swords color={colors.orange} size={18} />
                    <Text className="text-white font-bold text-base">Quién domina</Text>
                  </View>
                  <Text className="text-gray-300 text-sm leading-5">
                    <Text className="text-primary font-bold">{'Tú: '}</Text>
                    {comparison.mineWins.length ? comparison.mineWins.slice(0, 4).map((r) => r.label).join(', ') : 'ningún músculo por ahora'}
                  </Text>
                  <Text className="text-gray-300 text-sm leading-5 mt-1.5">
                    <Text className="text-sky-400 font-bold">{friendName + ': '}</Text>
                    {comparison.theirWins.length ? comparison.theirWins.slice(0, 4).map((r) => r.label).join(', ') : 'ningún músculo por ahora'}
                  </Text>
                </View>
              </FadeIn>
            ) : null}

            <FadeIn delay={260}>
              <View className="bg-surface border border-border rounded-3xl p-5 mt-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white font-bold text-base">Músculo por músculo</Text>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1"><View className="w-2.5 h-2.5 rounded-full bg-primary" /><Text className="text-gray-400 text-[11px]">Tú</Text></View>
                    <View className="flex-row items-center gap-1"><View className="w-2.5 h-2.5 rounded-full bg-sky-400" /><Text className="text-gray-400 text-[11px]" numberOfLines={1}>{friendName}</Text></View>
                  </View>
                </View>
                {ALL_REGIONS.filter((r) => mine.regions[r].score > 0 || theirs.regions[r].score > 0)
                  .sort((a, b) => Math.max(mine.regions[b].score, theirs.regions[b].score) - Math.max(mine.regions[a].score, theirs.regions[a].score))
                  .map((r) => (
                    <View key={r} className="mb-3">
                      <Text className="text-gray-300 text-xs font-semibold mb-1">{mine.regions[r].label}</Text>
                      <View className="flex-row items-center gap-2">
                        <View className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                          <View style={{ width: `${mine.regions[r].score}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 999 }} />
                        </View>
                        <Text className="text-gray-400 text-[11px] w-7 text-right">{mine.regions[r].score}</Text>
                      </View>
                      <View className="flex-row items-center gap-2 mt-1">
                        <View className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                          <View style={{ width: `${theirs.regions[r].score}%`, height: '100%', backgroundColor: colors.sky, borderRadius: 999 }} />
                        </View>
                        <Text className="text-gray-400 text-[11px] w-7 text-right">{theirs.regions[r].score}</Text>
                      </View>
                    </View>
                  ))}
              </View>
            </FadeIn>
          </>
        )}
      </ScrollView>
    )
  }

  // ----- Tu cuerpo -----
  const bodyWidth = Math.min(250, screenWidth * 0.62)
  const values: Partial<Record<Region, number>> =
    mode === 'recuperacion' && recoveryMap
      ? (Object.fromEntries(Object.entries(recoveryMap).map(([region, r]) => [region, r.recovery])) as Record<Region, number>)
      : regionValues(mine, mapMode)
  const hasData = mine.ranked.some((r) => r.volume > 0)

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 48 }}>
      <GlowOrb color={glowFor(mine)} size={420} style={{ top: 120, alignSelf: 'center' }} intensity={0.18} />
      <FadeIn>{header}</FadeIn>

      {/* Rango corporal */}
      <FadeIn delay={60}>
        <View className="bg-surface border border-border rounded-3xl p-4 mb-4 flex-row items-center gap-4">
          <AnimatedRing progress={mine.overallScore} size={84} stroke={9} colors={[TIER_COLOR[mine.overallTier], colors.primary]} delay={200}>
            <CountUp value={mine.overallScore} delay={200} className="text-white text-lg font-extrabold" />
          </AnimatedRing>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs">Rango corporal</Text>
            <Text className="text-white text-2xl font-extrabold mt-0.5">{mine.overallTier}</Text>
            <Text className="text-gray-500 text-[11px] mt-0.5">Promedio de tus 8 músculos más trabajados</Text>
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={100}>
        <ModeSwitch modes={MODES} mode={mode} onChange={setMode} />
        <Text className="text-gray-500 text-xs text-center mt-2">{MODE_HINT[mode]}</Text>
      </FadeIn>

      <FadeIn delay={160} style={{ alignItems: 'center', marginTop: 18 }}>
        <Body3D
          variant={variant}
          values={values}
          width={bodyWidth}
          colorFor={colorFor}
          selected={selected}
          onSelect={setSelected}
          glowColor={glowFor(mine)}
        />
        <View className="flex-row gap-2 mt-3">
          {(['male', 'female'] as BodyVariant[]).map((v) => (
            <Pressable
              key={v}
              onPress={() => changeVariant(v)}
              className={`px-3 py-1.5 rounded-full border ${variant === v ? 'bg-surface2 border-primary' : 'bg-surface border-border'}`}
            >
              <Text className={variant === v ? 'text-primary text-xs font-bold' : 'text-gray-400 text-xs'}>{v === 'male' ? 'Hombre' : 'Mujer'}</Text>
            </Pressable>
          ))}
        </View>
        <Legend mode={mode} />
      </FadeIn>

      {!hasData ? (
        <View className="bg-surface border border-border rounded-3xl p-5 mt-5 items-center">
          <Text className="text-white font-bold text-center">Tu mapa se enciende al entrenar</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">Completa entrenamientos y anota tus pesos: cada músculo trabajado se ilumina.</Text>
        </View>
      ) : selected ? (
        <FadeIn key={selected} distance={8}>
          <RegionDetail profile={mine} region={selected} recovery={mode === 'recuperacion' ? recoveryMap?.[selected] : undefined} />
        </FadeIn>
      ) : null}

      {hasData ? (
        <FadeIn delay={220}>
          <View className="bg-surface border border-border rounded-3xl p-5 mt-4">
            <Text className="text-white font-bold text-base mb-3">Tus músculos más trabajados</Text>
            {mine.ranked.filter((r) => r.score > 0).slice(0, 6).map((r) => (
              <Pressable key={r.region} onPress={() => setSelected(r.region)} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-white text-sm font-semibold">{r.label}</Text>
                  <View className="flex-row items-center gap-2">
                    {r.strength && r.strength > 0 ? (
                      <Text className="text-primary text-[11px] font-bold">{'+' + Math.round(r.strength * 100) + '% fuerza'}</Text>
                    ) : null}
                    {r.size && r.size.delta > 0 && r.region !== 'abs' && r.region !== 'obliques' ? (
                      <View className="flex-row items-center gap-0.5">
                        <Ruler color={colors.sky} size={11} />
                        <Text className="text-sky-400 text-[11px] font-bold">{'+' + r.size.delta + ' cm'}</Text>
                      </View>
                    ) : null}
                    <TierChip tier={r.tier} small />
                  </View>
                </View>
                <View className="h-2 rounded-full bg-surface2 overflow-hidden">
                  <View style={{ width: `${r.score}%`, height: '100%', borderRadius: 999, backgroundColor: mode === 'rango' ? TIER_COLOR[r.tier] : mode === 'recuperacion' && recoveryMap ? recoveryColor(recoveryMap[r.region].recovery) : heatColor(values[r.region] ?? 0) }} />
                </View>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      ) : null}

      {/* Comparar con amigos */}
      <FadeIn delay={280}>
        <View className="bg-surface border border-border rounded-3xl p-5 mt-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Users color={colors.sky} size={18} />
            <Text className="text-white font-bold text-base">Compárate con un amigo</Text>
          </View>
          <Text className="text-gray-400 text-xs mb-3">
            {sharing === null
              ? 'Pronto podrás compartir tu mapa con tus amigos.'
              : sharing
                ? 'Tu mapa está compartido con tus amigos.'
                : 'Tu mapa es privado. Actívalo en Privacidad y cuenta para que tus amigos te comparen.'}
          </Text>
          {friends.length === 0 ? (
            <Text className="text-gray-500 text-sm">Agrega amigos en Social para compararte.</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {friends.map((f) => (
                <PressableScale
                  key={f.id}
                  onPress={() => router.push({ pathname: '/(main)/cuerpo', params: { friendId: f.id, friendName: f.username } })}
                  accessibilityLabel={'Compararme con ' + f.username}
                >
                  <View className="flex-row items-center gap-1.5 bg-surface2 border border-border rounded-full px-3 py-2">
                    <Swords color={colors.sky} size={13} />
                    <Text className="text-white text-xs font-semibold">{f.username}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
        </View>
      </FadeIn>
    </ScrollView>
  )
}
