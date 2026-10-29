import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft, Trophy, Footprints, Dumbbell, Medal, CalendarCheck, Flame, Zap, Crown, Scale, Target,
  Pencil, Sparkles, Utensils, Salad, UserPlus, Users, Swords, Lock, Route, Timer, Mountain, MapPin,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { Badge, BadgeGroup, BadgeIcon, BADGE_GROUPS, computeBadges, loadAchievementStats, takeNewBadges } from '../../core/achievements'
import FadeIn from '../../components/ui/FadeIn'
import TiltCard from '../../components/ui/TiltCard'
import GradientFill from '../../components/ui/GradientFill'
import AnimatedRing from '../../components/ui/AnimatedRing'
import CountUp from '../../components/ui/CountUp'
import Skeleton from '../../components/ui/Skeleton'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, glow, gradients, GradientColors } from '../../components/ui/theme'

const ICONS: Record<BadgeIcon, LucideIcon> = {
  footprints: Footprints, dumbbell: Dumbbell, medal: Medal, calendar: CalendarCheck, flame: Flame, zap: Zap,
  crown: Crown, scale: Scale, target: Target, pencil: Pencil, sparkles: Sparkles, utensils: Utensils,
  salad: Salad, trophy: Trophy, 'user-plus': UserPlus, users: Users, swords: Swords,
  route: Route, timer: Timer, mountain: Mountain, 'map-pin': MapPin,
}

// 10000 -> 10.000 (la meta de pasos se lee mejor con separador de miles)
const fmt = (n: number) => n.toLocaleString('es-CO')

const GROUP_GRADIENTS: Record<BadgeGroup, GradientColors> = {
  Entrenamiento: gradients.brand,
  Constancia: gradients.ember,
  Cardio: ['#f97316', '#e11d48'],
  Progreso: gradients.ocean,
  Nutrición: gradients.gold,
  Social: gradients.violet,
}

function BadgeCard({ badge }: { badge: Badge }) {
  const Icon = ICONS[badge.icon]
  const gradient = GROUP_GRADIENTS[badge.group]
  const label = `${badge.title}. ${badge.description}. ${badge.unlocked ? 'Desbloqueada' : `${fmt(badge.progress)} de ${fmt(badge.goal)}`}`

  if (badge.unlocked) {
    return (
      <TiltCard glare radius={22} maxTilt={14} accessibilityLabel={label} style={glow(gradient[0], 16, 0.4)}>
        <View style={{ borderRadius: 22, overflow: 'hidden', padding: 14, minHeight: 156 }}>
          <GradientFill colors={gradient} radius={22} />
          <View className="w-12 h-12 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}>
            <Icon color="#0a0f0d" size={24} strokeWidth={2.3} />
          </View>
          <Text style={{ color: '#0a0f0d', fontWeight: '800', fontSize: 14 }}>{badge.title}</Text>
          <Text style={{ color: 'rgba(10,15,13,0.72)', fontSize: 11, marginTop: 2, lineHeight: 15 }}>{badge.description}</Text>
          <View className="self-start rounded-full px-2 py-0.5 mt-2.5" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>✓ DESBLOQUEADA</Text>
          </View>
        </View>
      </TiltCard>
    )
  }

  return (
    <TiltCard radius={22} maxTilt={10} accessibilityLabel={label}>
      <View className="bg-surface border border-border p-3.5" style={{ borderRadius: 22, minHeight: 156 }}>
        <View className="w-12 h-12 rounded-2xl bg-surface2 items-center justify-center mb-3">
          <Lock color={colors.muted} size={20} />
        </View>
        <Text className="text-gray-300 font-bold text-sm">{badge.title}</Text>
        <Text className="text-gray-500 text-[11px] mt-0.5 leading-4">{badge.description}</Text>
        <View className="mt-auto pt-2.5">
          <View className="h-1.5 rounded-full bg-surface2 overflow-hidden">
            <View style={{ width: `${(badge.progress / badge.goal) * 100}%`, height: '100%', borderRadius: 999, overflow: 'hidden' }}>
              <GradientFill colors={gradient} direction="horizontal" />
            </View>
          </View>
          <Text className="text-gray-500 text-[11px] mt-1">{fmt(badge.progress) + ' / ' + fmt(badge.goal)}</Text>
        </View>
      </View>
    </TiltCard>
  )
}

export default function LogrosScreen() {
  const router = useRouter()
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const computed = computeBadges(await loadAchievementStats(user.id))
      setBadges(computed)
      // Lo que ves aquí ya no se vuelve a avisar como insignia nueva
      await takeNewBadges(user.id, computed)
    } catch {
      setError('No pudimos cargar tus logros. Revisa tu conexión.')
    }
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const unlockedCount = badges.filter((b) => b.unlocked).length
  const percent = badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0
  // La insignia bloqueada a la que menos le falta (en proporción)
  const closest = badges
    .filter((b) => !b.unlocked)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)[0]

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <GlowOrb color={colors.gold} size={360} style={{ top: -140, right: -120 }} intensity={0.25} />

      <View className="flex-row items-center gap-3 mb-5">
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12}>
          <ArrowLeft color={colors.soft} size={22} />
        </Pressable>
        <Text className="text-white text-3xl font-extrabold">Logros</Text>
      </View>

      {loading ? (
        <>
          <Skeleton height={150} radius={28} />
          <View className="flex-row justify-between mt-5">
            <Skeleton height={156} width="48.5%" radius={22} />
            <Skeleton height={156} width="48.5%" radius={22} />
          </View>
        </>
      ) : error && badges.length === 0 ? (
        <View className="bg-surface border border-border rounded-3xl p-6 items-center">
          <Text className="text-gray-400 text-center">{error}</Text>
          <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
            <Text className="text-black font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FadeIn>
            <View className="bg-surface border border-border rounded-3xl p-5 mb-6 flex-row items-center gap-5">
              <AnimatedRing progress={percent} size={112} stroke={12} colors={gradients.gold} delay={200}>
                <Trophy color={colors.gold} size={22} />
                <CountUp value={percent} suffix="%" delay={200} className="text-white text-lg font-extrabold mt-0.5" />
              </AnimatedRing>
              <View className="flex-1">
                <View className="flex-row items-end">
                  <CountUp value={unlockedCount} className="text-white text-4xl font-extrabold" />
                  <Text className="text-gray-400 text-sm mb-1.5 ml-1">{'/ ' + badges.length}</Text>
                </View>
                <Text className="text-gray-400 text-xs">insignias desbloqueadas</Text>
                {closest ? (
                  <View className="bg-surface2 rounded-xl px-3 py-2 mt-3">
                    <Text className="text-gray-500 text-[11px]">Te falta poco</Text>
                    <Text className="text-white text-xs font-semibold mt-0.5" numberOfLines={1}>
                      {closest.title + ' · ' + fmt(closest.progress) + '/' + fmt(closest.goal)}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-primary text-xs font-semibold mt-3">¡Las tienes todas! 🏆</Text>
                )}
              </View>
            </View>
          </FadeIn>

          {BADGE_GROUPS.map((group, g) => {
            const items = badges.filter((b) => b.group === group)
            return (
              <View key={group} className="mb-3">
                <FadeIn delay={120 + g * 60}>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-white font-bold text-base">{group}</Text>
                    <Text className="text-gray-500 text-xs font-semibold">
                      {items.filter((b) => b.unlocked).length + '/' + items.length}
                    </Text>
                  </View>
                </FadeIn>
                <View className="flex-row flex-wrap justify-between">
                  {items.map((b, i) => (
                    <FadeIn key={b.id} delay={160 + g * 60 + i * 50} style={{ width: '48.5%', marginBottom: 12 }}>
                      <BadgeCard badge={b} />
                    </FadeIn>
                  ))}
                </View>
              </View>
            )
          })}
        </>
      )}
    </ScrollView>
  )
}
