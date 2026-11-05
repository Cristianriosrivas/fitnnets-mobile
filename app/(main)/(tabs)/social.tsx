import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Search, UserPlus, Check, X, Users, Trophy, PlusCircle, Swords } from 'lucide-react-native'
import { supabase } from '../../../core/supabase/client'
import { TAB_BAR_SPACE } from '../../../components/ui/AnimatedTabBar'
import FadeIn from '../../../components/ui/FadeIn'
import PressableScale from '../../../components/ui/PressableScale'
import GradientFill from '../../../components/ui/GradientFill'
import { GlowOrb } from '../../../components/ui/Aurora'
import { colors, glow, gradients } from '../../../components/ui/theme'

export default function SocialScreen() {
  const router = useRouter()
  const [myId, setMyId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const [friends, setFriends] = useState<any[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [outgoing, setOutgoing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadSocialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: sent } = await supabase
      .from('friendships')
      .select('id, status, friend_id, profiles!friendships_friend_id_fkey(id, username)')
      .eq('user_id', user.id)

    const { data: received } = await supabase
      .from('friendships')
      .select('id, status, user_id, profiles!friendships_user_id_fkey(id, username)')
      .eq('friend_id', user.id)

    const acceptedFromSent = (sent || []).filter((f) => f.status === 'aceptado').map((f) => ({ id: f.id, profile: f.profiles }))
    const acceptedFromReceived = (received || []).filter((f) => f.status === 'aceptado').map((f) => ({ id: f.id, profile: f.profiles }))

    setFriends([...acceptedFromSent, ...acceptedFromReceived])
    setOutgoing((sent || []).filter((f) => f.status === 'pendiente'))
    setIncoming((received || []).filter((f) => f.status === 'pendiente'))

    setLoading(false)
  }, [])

  useEffect(() => {
    loadSocialData()
  }, [loadSocialData])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadSocialData()
    setRefreshing(false)
  }

  const handleSearch = async () => {
    if (!searchTerm.trim() || !myId) return
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${searchTerm}%`)
      .neq('id', myId)
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  const sendRequest = async (friendId: string) => {
    if (!myId) return
    await supabase.from('friendships').insert({ user_id: myId, friend_id: friendId, status: 'pendiente' })
    setSearchResults((prev) => prev.filter((p) => p.id !== friendId))
    await loadSocialData()
  }

  const respondRequest = async (friendshipId: string, accept: boolean) => {
    if (accept) {
      await supabase.from('friendships').update({ status: 'aceptado' }).eq('id', friendshipId)
    } else {
      await supabase.from('friendships').delete().eq('id', friendshipId)
    }
    await loadSocialData()
  }

  const initials = (name: string) => name?.[0]?.toUpperCase() || '?'

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Cargando...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
    >
      <GlowOrb color={colors.sky} size={340} style={{ top: -170, left: -130 }} intensity={0.22} />
      <FadeIn>
        <View className="flex-row items-end justify-between mb-5">
          <View>
            <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
              Comunidad
            </Text>
            <Text className="text-white text-3xl font-extrabold mt-1">Social</Text>
          </View>
          <PressableScale onPress={() => router.push('/(main)/retos')} accessibilityLabel="Ver retos">
            <View className="rounded-full px-4 py-2.5 flex-row items-center gap-1.5 overflow-hidden" style={glow(colors.gold, 12, 0.4)}>
              <GradientFill colors={gradients.gold} radius={999} direction="horizontal" />
              <Trophy color="#422006" size={15} />
              <Text style={{ color: '#422006', fontWeight: '800', fontSize: 13 }}>Ver retos</Text>
            </View>
          </PressableScale>
        </View>
      </FadeIn>

      <View className="bg-surface border border-border rounded-xl p-4 mb-5">
        <Text className="text-white font-medium mb-2">Buscar amigos</Text>
        <View className="flex-row gap-2">
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            placeholder="Nombre de usuario..."
            placeholderTextColor="#6b7876"
            autoCapitalize="none"
            className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-white"
          />
          <Pressable onPress={handleSearch} disabled={searching} className="bg-surface2 border border-border rounded-lg px-3 items-center justify-center">
            <Search color="#9ca8a5" size={18} />
          </Pressable>
        </View>

        {searchResults.map((p) => (
          <View key={p.id} className="flex-row items-center justify-between bg-surface2 rounded-lg p-2.5 mt-2">
            <View className="flex-row items-center gap-2.5">
              <View className="w-7 h-7 rounded-full bg-green-500/15 items-center justify-center">
                <Text className="text-primary text-xs font-bold">{initials(p.username)}</Text>
              </View>
              <Text className="text-white text-sm">{p.username}</Text>
            </View>
            <Pressable onPress={() => sendRequest(p.id)} className="flex-row items-center gap-1">
              <UserPlus color="#22c55e" size={14} />
              <Text className="text-primary text-xs font-medium">Agregar</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {incoming.length > 0 && (
        <View className="mb-5">
          <Text className="text-white font-semibold text-sm mb-2">Solicitudes recibidas ({incoming.length})</Text>
          {incoming.map((req) => (
            <View key={req.id} className="bg-surface border border-border rounded-xl p-3 flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2.5">
                <View className="w-7 h-7 rounded-full bg-green-500/15 items-center justify-center">
                  <Text className="text-primary text-xs font-bold">{initials(req.profiles?.username)}</Text>
                </View>
                <Text className="text-white text-sm">{req.profiles?.username}</Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => respondRequest(req.id, true)} className="bg-primary rounded-lg p-1.5">
                  <Check color="black" size={14} />
                </Pressable>
                <Pressable onPress={() => respondRequest(req.id, false)} className="bg-surface2 rounded-lg p-1.5">
                  <X color="#9ca8a5" size={14} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {outgoing.length > 0 && (
        <View className="mb-5">
          <Text className="text-white font-semibold text-sm mb-2">Solicitudes enviadas ({outgoing.length})</Text>
          {outgoing.map((req) => (
            <View key={req.id} className="bg-surface border border-border rounded-xl p-3 flex-row items-center justify-between mb-2">
              <Text className="text-gray-400 text-sm">{req.profiles?.username}</Text>
            </View>
          ))}
        </View>
      )}

      <Text className="text-white font-semibold text-sm mb-2 flex-row items-center gap-1.5">
        Tus amigos ({friends.length})
      </Text>
      {friends.length === 0 ? (
        <View className="bg-surface border border-border rounded-2xl p-8 items-center">
          <Text className="text-gray-400 text-center">Aún no tienes amigos agregados.</Text>
        </View>
      ) : (
        friends.map((f) => (
          <View key={f.id} className="bg-surface border border-border rounded-2xl p-3 flex-row items-center mb-2 gap-2">
            <View className="w-10 h-10 rounded-full bg-green-500/15 items-center justify-center mr-1">
              <Text className="text-primary text-sm font-bold">{initials(f.profile?.username)}</Text>
            </View>
            <Text className="text-white text-sm font-semibold flex-1" numberOfLines={1}>{f.profile?.username}</Text>
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: '/(main)/cuerpo',
                  params: { friendId: f.profile?.id, friendName: f.profile?.username },
                })
              }
              accessibilityLabel={'Comparar mi cuerpo con ' + f.profile?.username}
            >
              <View className="bg-violet-500/15 border border-violet-400/30 rounded-xl px-2.5 py-2 flex-row items-center gap-1.5">
                <Swords color={colors.violet} size={14} />
                <Text className="text-violet-300 text-xs font-semibold">Comparar</Text>
              </View>
            </PressableScale>
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: '/(main)/rutinas-nueva',
                  params: { friendId: f.profile?.id, friendName: f.profile?.username },
                })
              }
              accessibilityLabel={'Crear rutina para ' + f.profile?.username}
            >
              <View className="bg-surface2 border border-border rounded-xl px-2.5 py-2 flex-row items-center gap-1.5">
                <PlusCircle color={colors.primary} size={14} />
                <Text className="text-primary text-xs font-semibold">Rutina</Text>
              </View>
            </PressableScale>
          </View>
        ))
      )}
    </ScrollView>
  )
}