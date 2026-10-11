import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Plus, Trophy, Users } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'

export default function RetosScreen() {
  const router = useRouter()
  const [myId, setMyId] = useState<string | null>(null)
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [metric, setMetric] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadChallenges = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setMyId(user.id)

    const { data } = await supabase
      .from('challenges')
      .select('id, title, description, metric, end_date, challenge_participants(id, user_id, current_score, profiles(username))')
      .order('created_at', { ascending: false })

    setChallenges(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadChallenges()
  }, [loadChallenges])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadChallenges()
    setRefreshing(false)
  }

  const handleCreate = async () => {
    setError('')
    if (!title.trim() || !metric.trim()) {
      setError('El título y la métrica son obligatorios')
      return
    }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: challenge, error: createError } = await supabase
      .from('challenges')
      .insert({
        creator_id: user.id,
        title,
        description,
        metric,
        start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setSaving(false)
      return
    }

    await supabase.from('challenge_participants').insert({ challenge_id: challenge.id, user_id: user.id, current_score: 0 })

    setTitle('')
    setDescription('')
    setMetric('')
    setShowCreate(false)
    setSaving(false)
    await loadChallenges()
  }

  const joinChallenge = async (challengeId: string) => {
    if (!myId) return
    await supabase.from('challenge_participants').insert({ challenge_id: challengeId, user_id: myId, current_score: 0 })
    await loadChallenges()
  }

  const updateMyScore = async (participantId: string, newScore: string) => {
    const value = parseInt(newScore) || 0
    await supabase.from('challenge_participants').update({ current_score: value }).eq('id', participantId)
  }

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
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
    >
      <View className="flex-row items-center gap-3 mb-5">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color="#9ca8a5" size={20} />
        </Pressable>
        <Text className="text-white text-2xl font-bold flex-1">Retos</Text>
        <Pressable
          onPress={() => setShowCreate((v) => !v)}
          className="bg-primary rounded-lg px-3 py-2 flex-row items-center gap-1.5"
        >
          <Plus color="black" size={14} />
          <Text className="text-black text-xs font-semibold">Crear</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View className="bg-surface border border-border rounded-xl p-4 mb-5">
          <Text className="text-gray-400 text-xs mb-1">Título del reto</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="ej: Reto de 30 días de sentadillas"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white mb-3"
          />
          <Text className="text-gray-400 text-xs mb-1">Descripción (opcional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white mb-3"
            style={{ minHeight: 50 }}
          />
          <Text className="text-gray-400 text-xs mb-1">¿Qué se mide?</Text>
          <TextInput
            value={metric}
            onChangeText={setMetric}
            placeholder="ej: flexiones totales"
            placeholderTextColor="#6b7876"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-white mb-3"
          />

          {error ? <Text className="text-red-400 text-xs mb-2">{error}</Text> : null}

          <Pressable onPress={handleCreate} disabled={saving} className="bg-primary rounded-lg py-2.5 items-center">
            <Text className="text-black font-semibold text-sm">{saving ? 'Creando...' : 'Crear reto'}</Text>
          </Pressable>
        </View>
      )}

      {challenges.length === 0 ? (
        <View className="bg-surface border border-border rounded-2xl p-8 items-center">
          <Trophy color="#2a3532" size={32} />
          <Text className="text-gray-400 text-center mt-2">Aún no hay retos.</Text>
        </View>
      ) : (
        challenges.map((challenge) => {
          const participants = (challenge.challenge_participants || []).slice().sort((a: any, b: any) => b.current_score - a.current_score)
          const myParticipation = participants.find((p: any) => p.user_id === myId)

          return (
            <View key={challenge.id} className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-white font-bold">{challenge.title}</Text>
                  {challenge.description ? (
                    <Text className="text-gray-400 text-xs mt-1">{challenge.description}</Text>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-1 bg-surface2 rounded-full px-2 py-1">
                  <Users color="#6b7876" size={11} />
                  <Text className="text-gray-500 text-[10px]">{participants.length}</Text>
                </View>
              </View>

              <Text className="text-gray-500 text-xs mt-2 capitalize">Métrica: {challenge.metric}</Text>

              <View className="mt-3 gap-1.5">
                {participants.map((p: any, index: number) => (
                  <View
                    key={p.id}
                    className={`flex-row items-center justify-between px-3 py-2 rounded-lg ${
                      p.user_id === myId ? 'bg-green-500/10' : 'bg-surface2'
                    }`}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Text className={`text-xs font-bold w-4 ${index === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {index + 1}
                      </Text>
                      <Text className="text-white text-sm">{p.profiles?.username}</Text>
                    </View>
                    <Text className="text-white text-sm font-semibold">{p.current_score}</Text>
                  </View>
                ))}
              </View>

              <View className="mt-3 pt-3 border-t border-border">
                {myParticipation ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      defaultValue={String(myParticipation.current_score)}
                      onEndEditing={(e) => updateMyScore(myParticipation.id, e.nativeEvent.text)}
                      keyboardType="number-pad"
                      className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-white w-20 text-center"
                    />
                    <Text className="text-gray-500 text-xs">Actualiza tu puntaje</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => joinChallenge(challenge.id)} className="bg-primary rounded-lg px-4 py-2 self-start">
                    <Text className="text-black text-sm font-semibold">Unirme al reto</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}