import { Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase/client'
import { notifyNow } from './notifications'
import { computeBadges, loadAchievementStats, takeNewBadges } from './achievements'

// Revisiones que se hacen al abrir la app o al volver a ella. Si no hay permiso de
// notificaciones, el aviso se muestra como alerta dentro de la app.

const ASSIGNED_KEY = (userId: string) => `finnets.assigned.lastSeen.${userId}`
let checkingRoutines = false
let checkingBadges = false

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

async function notifyOrAlert(title: string, body: string, url: string) {
  const shown = await notifyNow(title, body, url).catch(() => false)
  if (!shown) Alert.alert(title, body)
}

// Rutinas que un amigo te asignó desde la última revisión (assign_routine las crea con created_by)
export async function checkAssignedRoutines() {
  if (checkingRoutines) return
  checkingRoutines = true
  try {
    const userId = await currentUserId()
    if (!userId) return

    const lastSeen = await AsyncStorage.getItem(ASSIGNED_KEY(userId))
    if (!lastSeen) {
      // Primera vez en este teléfono: solo se avisa de lo que llegue desde ahora
      await AsyncStorage.setItem(ASSIGNED_KEY(userId), new Date().toISOString())
      return
    }

    const { data, error } = await supabase
      .from('routines')
      .select('id, title, created_at, creator:profiles!routines_created_by_fkey(username)')
      .eq('user_id', userId)
      .not('created_by', 'is', null)
      .neq('created_by', userId)
      .gt('created_at', lastSeen)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) return

    await AsyncStorage.setItem(ASSIGNED_KEY(userId), data[data.length - 1].created_at)
    for (const routine of data.slice(-3)) {
      const creator = (routine.creator as { username?: string } | null)?.username || 'Un amigo'
      await notifyOrAlert(`${creator} te asignó una rutina`, `"${routine.title}" ya está en tu lista de rutinas.`, '/(main)/(tabs)/rutinas')
    }
  } finally {
    checkingRoutines = false
  }
}

export async function checkNewBadges() {
  if (checkingBadges) return
  checkingBadges = true
  try {
    const userId = await currentUserId()
    if (!userId) return
    const badges = computeBadges(await loadAchievementStats(userId))
    const fresh = await takeNewBadges(userId, badges)
    for (const badge of fresh.slice(0, 3)) {
      await notifyOrAlert('¡Nueva insignia! 🏆', `${badge.title}: ${badge.description}.`, '/(main)/logros')
    }
  } catch {
    // Sin conexión: se vuelve a revisar la próxima vez que se abra la app
  } finally {
    checkingBadges = false
  }
}
