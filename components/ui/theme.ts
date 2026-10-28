// Paleta de Finnets. La base (fondo, verde, borde, texto secundario) es la de la web;
// los acentos y degradados dan profundidad a tarjetas, iconos y botones.
export const colors = {
  bg: '#0a0f0d',
  surface: '#141b19',
  surface2: '#1c2523',
  border: '#2a3532',
  primary: '#22c55e',
  lime: '#a3e635',
  teal: '#14b8a6',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#f59e0b',
  orange: '#fb923c',
  rose: '#fb7185',
  gold: '#facc15',
  text: '#ffffff',
  soft: '#9ca8a5',
  muted: '#6b7876',
} as const

export type GradientColors = readonly [string, string, ...string[]]

export const gradients = {
  brand: ['#22c55e', '#a3e635'],
  forest: ['#15803d', '#064e3b'],
  ocean: ['#14b8a6', '#38bdf8'],
  ember: ['#fb923c', '#f43f5e'],
  violet: ['#a78bfa', '#6366f1'],
  gold: ['#facc15', '#f59e0b'],
  steel: ['#2a3532', '#1c2523'],
} as const satisfies Record<string, GradientColors>

// Sombra de color para elementos destacados (iOS la pinta como resplandor; Android usa elevation)
export const glow = (color: string, radius = 16, opacity = 0.45) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
})
