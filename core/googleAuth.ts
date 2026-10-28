import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from './supabase/client'

// Inicio de sesion con Google compartido por login y registro.
// 'cancel' = el usuario cerro el navegador; no se muestra error.
export async function signInWithGoogle(): Promise<'ok' | 'cancel' | 'error'> {
  const redirectUrl = Linking.createURL('auth/callback')

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  })

  if (oauthError || !data?.url) return 'error'

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
  if (result.type !== 'success' || !result.url) return 'cancel'

  const resultUrl = result.url

  // Caso 1: Supabase devuelve tokens en el fragmento (#access_token=...)
  if (resultUrl.includes('#')) {
    const params = new URLSearchParams(resultUrl.split('#')[1])
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token })
      return 'ok'
    }
  }

  // Caso 2: Supabase devuelve un codigo en query (?code=...)
  const code = Linking.parse(resultUrl).queryParams?.code as string | undefined
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    return exchangeError ? 'error' : 'ok'
  }

  return 'error'
}
