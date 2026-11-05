import AsyncStorage from '@react-native-async-storage/async-storage'

// Generación con IA: la petición al backend y el tiempo estimado de la barra de carga.
// Gemini no informa su avance, así que la barra se basa en cuánto tardaron las últimas
// generaciones en este dispositivo.

export type AiTask = 'routine' | 'mealplan'

const DEFAULT_MS: Record<AiTask, number> = { routine: 30_000, mealplan: 18_000 }
const KEY = (task: AiTask) => `finnets.ai.ms.${task}`
const MIN_MS = 5_000
const MAX_MS = 90_000

// El backend prueba varios modelos durante unos 100 s: el cliente espera un poco más
const REQUEST_TIMEOUT_MS = 125_000

const STAGES: Record<AiTask, string[]> = {
  routine: ['Leyendo tu perfil', 'Eligiendo ejercicios', 'Armando tus días', 'Ajustando series y descansos', 'Guardando tu rutina'],
  mealplan: ['Calculando tus calorías', 'Eligiendo alimentos', 'Armando tus comidas', 'Guardando tu plan'],
}

export async function expectedDuration(task: AiTask) {
  const saved = Number(await AsyncStorage.getItem(KEY(task)))
  return saved >= MIN_MS ? saved : DEFAULT_MS[task]
}

// Promedio móvil: pesa más lo reciente, sin que una generación rara lo descuadre
export async function recordDuration(task: AiTask, ms: number) {
  const previous = await expectedDuration(task)
  const next = Math.round(previous * 0.6 + ms * 0.4)
  await AsyncStorage.setItem(KEY(task), String(Math.max(MIN_MS, Math.min(MAX_MS, next))))
}

// Avanza parejo hasta el 90 % en el tiempo esperado y luego se acerca al 97 % sin llegar:
// nunca dice que terminó antes de tiempo
export function progressAt(elapsedMs: number, expectedMs: number) {
  const x = elapsedMs / expectedMs
  return x < 1 ? x * 90 : 90 + 7 * (1 - Math.exp(-(x - 1) * 2))
}

export function remainingLabel(elapsedMs: number, expectedMs: number) {
  const left = Math.ceil((expectedMs - elapsedMs) / 1000)
  if (left > 1) return `Faltan unos ${left} s`
  return elapsedMs > expectedMs * 1.5 ? 'Está tardando más de lo normal, ya casi' : 'Ya casi'
}

export function stageLabel(task: AiTask, percent: number) {
  const stages = STAGES[task]
  return stages[Math.min(stages.length - 1, Math.floor((percent / 100) * stages.length))]
}

export type AiResult = { ok: true; data: any } | { ok: false; message: string }

// POST a una ruta de IA con mensajes distintos para cada tipo de fallo
export async function postAi(url: string, init: { headers?: Record<string, string>; body?: string } = {}): Promise<AiResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: init.body,
      signal: controller.signal,
    })
    const text = await res.text()
    let data: any = {}
    try {
      data = JSON.parse(text)
    } catch {
      // Vercel responde HTML cuando la función se pasa de tiempo
    }
    if (res.ok) return { ok: true, data }
    if (res.status === 401) return { ok: false, message: 'Tu sesión caducó. Vuelve a iniciar sesión.' }
    if (data.error) return { ok: false, message: data.error }
    return { ok: false, message: 'El servidor no pudo responder a tiempo. Intenta de nuevo.' }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { ok: false, message: 'La IA tardó demasiado. Intenta de nuevo.' }
    return { ok: false, message: 'No se pudo conectar con el servidor. Revisa tu internet.' }
  } finally {
    clearTimeout(timer)
  }
}
