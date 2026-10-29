import { Crown, Gem, Medal, Trophy } from 'lucide-react-native'
import type { RankTier } from '../../core/training'
import type { GradientColors } from './theme'

// Colores e icono de cada rango (entrenamiento de gimnasio y carreras)
export const TIER_STYLE: Record<RankTier, { colors: GradientColors; text: string; icon: typeof Medal }> = {
  Bronce: { colors: ['#f59e0b', '#b45309', '#78350f'], text: '#fff7ed', icon: Medal },
  Plata: { colors: ['#f3f4f6', '#9ca3af', '#4b5563'], text: '#111827', icon: Medal },
  Oro: { colors: ['#fde047', '#f59e0b', '#b45309'], text: '#422006', icon: Trophy },
  Platino: { colors: ['#a5f3fc', '#22d3ee', '#0e7490'], text: '#083344', icon: Gem },
  Diamante: { colors: ['#c4b5fd', '#818cf8', '#22d3ee'], text: '#1e1b4b', icon: Crown },
}
