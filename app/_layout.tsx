import '../global.css'
import { Stack } from 'expo-router'
import { configureNotifications } from '../core/notifications'

configureNotifications()

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
