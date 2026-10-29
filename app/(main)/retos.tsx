import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Plus, Trophy, Users, Swords, Target, X } from 'lucide-react-native'
import { supabase } from '../../core/supabase/client'
import FadeIn from '../../components/ui/FadeIn'
import PressableScale from '../../components/ui/PressableScale'
import GradientButton from '../../components/ui/GradientButton'
import GradientFill from '../../components/ui/GradientFill'
import IconBadge from '../../components/ui/IconBadge'
import Skeleton from '../../components/ui/Skeleton'
import { GlowOrb } from '../../components/ui/Aurora'
import { colors, glow, gradients, GradientColors } from '../../components/ui/theme'

// Oro, plata y bronce para el podio
const MEDALS: GradientColors[] = [gradients.gold, ['#e5e7eb', '#9ca3af'], ['#fdba74', '#c2410c']]
const CARD_GRADIENTS: GradientColors[] = [gradients.ember, gradients.violet, gradients.ocean, gradients.brand]

const inputClass = 'bg-surface2 border border-border rounded-2xl px-4 py-3 text-white mb-3'

function PositionBadge({ index }: { index: number }) {
  if (index < 3) {
    return (
      <IconBadge colors={MEDALS[index]} size={26} radius={13} shine={index === 0}>
        <Text style={{ color: '#1f1300', fontWeight: '900', fontSize: 12 }}>{index + 1}</Text>
      </IconBadge>
    )
  }
  return (
    <View className="w-[26px] h-[26px] rounded-full bg-surface2 items-center justify-center">
      <Text className="text-gray-500 text-xs font-bold">{index + 1}</Text>
    </View>
  )
}

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

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <GlowOrb color={colors.orange} size={360} style={{ top: -170, right: -140 }} intensity={0.24} />

        <FadeIn>
          <View className="flex-row items-end gap-3 mb-5">
            <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={12} className="mb-1.5">
              <ArrowLeft color={colors.soft} size={22} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-primary text-xs font-bold uppercase" style={{ letterSpacing: 2 }}>
                Compite con tus amigos
              </Text>
              <Text className="text-white text-3xl font-extrabold mt-1">Retos</Text>
            </View>
            <PressableScale onPress={() => setShowCreate((v) => !v)} accessibilityLabel={showCreate ? 'Cerrar formulario' : 'Crear reto'}>
              <View className="rounded-full w-11 h-11 items-center justify-center overflow-hidden" style={glow(colors.primary, 12, 0.5)}>
                <GradientFill colors={gradients.brand} radius={22} />
                {showCreate ? <X color="#04120a" size={20} /> : <Plus color="#04120a" size={20} />}
              </View>
            </PressableScale>
          </View>
        </FadeIn>

        {showCreate && (
          <FadeIn distance={10}>
            <View className="bg-surface border border-border rounded-3xl p-5 mb-5">
              <Text className="text-white font-bold text-base mb-4">Nuevo reto</Text>
              <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">Título del reto</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="ej: 30 días de sentadillas"
                placeholderTextColor={colors.muted}
                className={inputClass}
              />
              <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">Descripción (opcional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholderTextColor={colors.muted}
                className={inputClass}
                style={{ minHeight: 64, textAlignVertical: 'top' }}
              />
              <Text className="text-gray-400 text-xs font-semibold mb-1.5 ml-1">¿Qué se mide?</Text>
              <TextInput
                value={metric}
                onChangeText={setMetric}
                placeholder="ej: flexiones totales"
                placeholderTextColor={colors.muted}
                className={inputClass}
              />

              {error ? <Text className="text-red-400 text-xs mb-3">{error}</Text> : null}

              <GradientButton
                title={saving ? 'Creando...' : 'Crear reto'}
                onPress={handleCreate}
                loading={saving}
                icon={<Swords color="#04120a" size={17} />}
              />
            </View>
          </FadeIn>
        )}

        {loading ? (
          <>
            <Skeleton height={200} radius={24} style={{ marginBottom: 14 }} />
            <Skeleton height={200} radius={24} />
          </>
        ) : challenges.length === 0 ? (
          <FadeIn delay={100}>
            <View className="bg-surface border border-border rounded-3xl p-8 items-center">
              <IconBadge colors={gradients.ember} size={60} radius={20}>
                <Trophy color="#ffffff" size={28} />
              </IconBadge>
              <Text className="text-white font-bold text-base mt-4">Aún no hay retos</Text>
              <Text className="text-gray-400 text-sm text-center mt-1">Crea el primero y reta a tus amigos.</Text>
            </View>
          </FadeIn>
        ) : (
          challenges.map((challenge, c) => {
            const participants = (challenge.challenge_participants || []).slice().sort((a: any, b: any) => b.current_score - a.current_score)
            const myParticipation = participants.find((p: any) => p.user_id === myId)

            return (
              <FadeIn key={challenge.id} delay={80 + Math.min(c, 6) * 70}>
                <View className="bg-surface border border-border rounded-3xl p-4 mb-4">
                  <View className="flex-row items-start gap-3">
                    <IconBadge colors={CARD_GRADIENTS[c % CARD_GRADIENTS.length]} size={44} radius={14}>
                      <Swords color="#ffffff" size={20} />
                    </IconBadge>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-base">{challenge.title}</Text>
                      {challenge.description ? (
                        <Text className="text-gray-400 text-xs mt-1 leading-4">{challenge.description}</Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center gap-1 bg-surface2 rounded-full px-2.5 py-1">
                      <Users color={colors.muted} size={12} />
                      <Text className="text-gray-400 text-xs font-semibold">{participants.length}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-1.5 self-start bg-surface2 rounded-full px-2.5 py-1 mt-3">
                    <Target color={colors.primary} size={12} />
                    <Text className="text-gray-300 text-xs capitalize">{challenge.metric}</Text>
                  </View>

                  <View className="mt-3 gap-1.5">
                    {participants.map((p: any, index: number) => {
                      const mine = p.user_id === myId
                      return (
                        <View
                          key={p.id}
                          className={`flex-row items-center justify-between px-3 py-2.5 rounded-2xl ${
                            mine ? 'bg-green-500/10 border border-green-500/30' : 'bg-surface2'
                          }`}
                        >
                          <View className="flex-row items-center gap-3 flex-1">
                            <PositionBadge index={index} />
                            <Text className={`text-sm flex-1 ${mine ? 'text-white font-bold' : 'text-white'}`} numberOfLines={1}>
                              {(p.profiles?.username || 'Usuario') + (mine ? ' (tú)' : '')}
                            </Text>
                          </View>
                          <Text className={`text-base font-extrabold ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                            {p.current_score}
                          </Text>
                        </View>
                      )
                    })}
                  </View>

                  <View className="mt-4 pt-4 border-t border-border">
                    {myParticipation ? (
                      <View className="flex-row items-center gap-3">
                        <TextInput
                          defaultValue={String(myParticipation.current_score)}
                          onEndEditing={(e) => updateMyScore(myParticipation.id, e.nativeEvent.text)}
                          keyboardType="number-pad"
                          accessibilityLabel="Tu puntaje"
                          className="bg-surface2 border border-border rounded-2xl px-3 py-2.5 text-white w-24 text-center text-base font-bold"
                        />
                        <Text className="text-gray-500 text-xs flex-1">Escribe tu nuevo puntaje y cierra el teclado para guardarlo.</Text>
                      </View>
                    ) : (
                      <GradientButton
                        title="Unirme al reto"
                        onPress={() => joinChallenge(challenge.id)}
                        icon={<Plus color="#04120a" size={17} />}
                      />
                    )}
                  </View>
                </View>
              </FadeIn>
            )
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
