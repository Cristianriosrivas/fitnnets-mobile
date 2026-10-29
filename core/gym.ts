// Herramientas de gimnasio: discos por lado, calentamiento, 1RM estimado y nivel de fuerza.

export const BAR_KG = 20
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

// Discos que van a cada lado de una barra olímpica de 20 kg (null si el peso no llega a la barra)
export function platesPerSide(totalKg: number): number[] | null {
  if (totalKg < BAR_KG) return null
  let side = (totalKg - BAR_KG) / 2
  const plates: number[] = []
  for (const plate of PLATES_KG) {
    while (side >= plate - 1e-9) {
      plates.push(plate)
      side -= plate
    }
  }
  return plates
}

export const formatKg = (kg: number) => String(Math.round(kg * 100) / 100).replace('.', ',')

// Series de aproximación antes de la serie de trabajo
export function warmupSets(workingKg: number, step: number): { weight: number; reps: number }[] {
  if (workingKg < 30) return []
  const round = (kg: number) => Math.max(step, Math.round(kg / step) * step)
  const sets = [
    { weight: round(workingKg * 0.5), reps: 8 },
    { weight: round(workingKg * 0.7), reps: 5 },
    { weight: round(workingKg * 0.85), reps: 3 },
  ]
  return sets.filter((s, i) => s.weight < workingKg && (i === 0 || s.weight !== sets[i - 1].weight))
}

// 1RM estimado con la fórmula de Epley: peso x (1 + repeticiones / 30)
export function estimateOneRepMax(weightKg: number, reps: number) {
  if (reps <= 1) return weightKg
  return Math.round(weightKg * (1 + Math.min(reps, 15) / 30) * 2) / 2
}

export type StrengthLevel = 'Principiante' | 'Novato' | 'Intermedio' | 'Avanzado' | 'Élite'

// 1RM / peso corporal para pasar a novato, intermedio, avanzado y élite (estándares orientativos, hombres)
const STANDARDS: [string, [number, number, number, number]][] = [
  ['peso muerto', [1.25, 1.75, 2.5, 3]],
  ['sentadilla goblet', [0, 0, 0, 0]],
  ['sentadilla bulgara', [0, 0, 0, 0]],
  ['sentadilla', [1, 1.5, 2, 2.5]],
  ['press de banca', [0.75, 1, 1.5, 2]],
  ['press militar', [0.5, 0.75, 1, 1.4]],
  ['remo', [0.6, 0.9, 1.2, 1.6]],
  ['hip thrust', [1, 1.5, 2.25, 3]],
]
const LEVELS: StrengthLevel[] = ['Principiante', 'Novato', 'Intermedio', 'Avanzado', 'Élite']

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function strengthLevel(exerciseName: string, oneRepMaxKg: number, bodyweightKg: number | null, gender: string | null) {
  if (!bodyweightKg || bodyweightKg < 30) return null
  const match = STANDARDS.find(([key]) => normalize(exerciseName).includes(key))
  if (!match || match[1][0] === 0) return null
  const factor = gender === 'femenino' ? 0.65 : 1
  const thresholds = match[1].map((t) => t * factor)
  const ratio = oneRepMaxKg / bodyweightKg
  const index = thresholds.filter((t) => ratio >= t).length
  const nextRatio = thresholds[index]
  return {
    ratio: Math.round(ratio * 100) / 100,
    level: LEVELS[index],
    next: nextRatio ? { level: LEVELS[index + 1], kg: Math.ceil((nextRatio * bodyweightKg) / 2.5) * 2.5 } : null,
  }
}
