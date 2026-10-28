import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft, Trophy, Footprints, Dumbbell, Medal, CalendarCheck, Flame, Zap, Crown, Scale, Target,
  Pencil, Sparkles, Utensils, Salad, UserPlus, Users, Swords, Lock,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import { Badge, BadgeIcon, BADGE_GROUPS, computeBadges, loadAchievementStats, takeNewBadges } from '../../core/achievements'

const ICONS: Record<BadgeIcon, LucideIcon> = {
  footprints: Footprints, dumbbell: Dumbbell, medal: Medal, calendar: CalendarCheck, flame: Flame, zap: Zap,
  crown: Crown, scale: Scale, target: Target, pencil: Pencil, sparkles: Sparkles, utensils: Utensils,
  salad: Salad, trophy: Trophy, 'user-plus': UserPlus, users: Users, swords: Swords,
}

function BadgeCard({ badge }: { badge: Badge }) {
  const Icon = ICONS[badge.icon]
  return (
    <View
      className={`rounded-2xl border p-3 mb-3 ${badge.unlocked ? 'bg-green-500/10 border-green-500/40' : 'bg-surface border-border'}`}
      style={{ width: '48.5%' }}
      accessibilityLabel={`${badge.title}. ${badge.description}. ${badge.unlocked ? 'Desbloqueada' : `${badge.progress} de ${badge.goal}`}`}
    >
      <View
        className={`w-11 h-11 rounded-full items-center justify-center mb-2 ${badge.unlocked ? 'bg-primary' : 'bg-surface2'}`}
      >
        {badge.unlocked ? <Icon color="black" size={20} /> : <Lock color="#6b7876" size={18} />}
      </View>
      <Text className={`font-semibold text-sm ${badge.unlocked ? 'text-white' : 'text-gray-400'}`}>{badge.title}</Text>
      <Text className="text-gray-500 text-xs mt-0.5 leading-4">{badge.description}</Text>
      {badge.unlocked ? (
        <Text className="text-primary text-[11px] font-medium mt-2">Desbloqueada</Text>
      ) : (
        <View className="mt-2">
          <View className="h-1.5 rounded-full bg-surface2 overflow-hidden">
            <View className="h-1.5 rounded-full bg-primary" style={{ width: `${(badge.progress / badge.goal) * 100}%` }} />
          </View>
          <Text className="text-gray-500 text-[11px] mt-1">{badge.progress + ' / ' + badge.goal}</Text>
        </View>
      )}
    </View>
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

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
    >
      <View className="flex-row items-center gap-3 mb-5">
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12}>
          <ArrowLeft color="#9ca8a5" size={20} />
        </Pressable>
        <Text className="text-white text-2xl font-bold">Logros</Text>
      </View>

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator color="#22c55e" size="large" />
        </View>
      ) : error && badges.length === 0 ? (
        <View className="bg-surface border border-border rounded-2xl p-6 items-center">
          <Text className="text-gray-400 text-center">{error}</Text>
          <Pressable onPress={load} className="bg-primary rounded-xl px-5 py-2.5 mt-4">
            <Text className="text-black font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="bg-surface border border-border rounded-2xl p-5 mb-5 flex-row items-center gap-4">
            <View className="bg-yellow-500/15 rounded-full p-3">
              <Trophy color="#facc15" size={26} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">{unlockedCount + ' de ' + badges.length}</Text>
              <Text className="text-gray-400 text-xs mb-2">insignias desbloqueadas</Text>
              <View className="h-2 rounded-full bg-surface2 overflow-hidden">
                <View
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${badges.length ? (unlockedCount / badges.length) * 100 : 0}%` }}
                />
              </View>
            </View>
          </View>

          {BADGE_GROUPS.map((group) => (
            <View key={group} className="mb-2">
              <Text className="text-white font-semibold text-sm mb-3">{group}</Text>
              <View className="flex-row flex-wrap justify-between">
                {badges.filter((b) => b.group === group).map((b) => (
                  <BadgeCard key={b.id} badge={b} />
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}
