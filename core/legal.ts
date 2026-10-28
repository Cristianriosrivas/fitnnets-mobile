import type { User } from '@supabase/supabase-js'

// Debe coincidir con POLICY_VERSION de la web (src/core/legal/content.ts).
// Si cambia, la app vuelve a pedir la autorizacion a todos los usuarios.
export const CONSENT_VERSION = '2026-10-15'

export const CONTACT_EMAIL = 'cristiandavidriosrivas@gmail.com'

export const PRIVACY_URL = `${process.env.EXPO_PUBLIC_API_URL}/privacidad`
export const TERMS_URL = `${process.env.EXPO_PUBLIC_API_URL}/terminos`

export type ConsentFields = {
  consent_version: string
  terms_accepted_at: string
  health_data_consent_at: string
}

// Mismos nombres que las columnas de profiles: se mandan como metadatos en signUp
// y se copian al perfil (el trigger handle_new_user solo copia el username)
export function buildConsent(): ConsentFields {
  const now = new Date().toISOString()
  return { consent_version: CONSENT_VERSION, terms_accepted_at: now, health_data_consent_at: now }
}

// Consentimiento vigente que el usuario dio al registrarse y que aun no llego a profiles
// (pasa cuando el registro exige confirmar el correo y no hubo sesion para guardarlo)
export function consentFromMetadata(user: User): ConsentFields | null {
  const meta = user.user_metadata || {}
  if (meta.consent_version !== CONSENT_VERSION || !meta.terms_accepted_at || !meta.health_data_consent_at) {
    return null
  }
  return {
    consent_version: meta.consent_version,
    terms_accepted_at: meta.terms_accepted_at,
    health_data_consent_at: meta.health_data_consent_at,
  }
}
