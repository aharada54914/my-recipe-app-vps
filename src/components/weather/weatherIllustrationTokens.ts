import type { WeatherVisualVariant } from '../../utils/season-weather/weatherPresentation'

export const WEATHER_COLORS = {
  outline: '#0F172A',
  iconOutline: '#E2E8F0',
  sun: '#F59E0B',
  sunGlow: '#FDE68A',
  moon: '#E2E8F0',
  moonGlow: '#93C5FD',
  cloudLight: '#F8FAFC',
  cloudDark: '#CBD5E1',
  rain: '#60A5FA',
  snow: '#FFFFFF',
  snowOutline: '#7DD3FC',
  storm: '#FACC15',
  fog: '#D1D5DB',
  windy: '#BFDBFE',
}

export const WEATHER_TILE_TOKENS: Record<WeatherVisualVariant, {
  background: string
  border: string
  badgeBg: string
  badgeText: string
  tempHigh: string
  tempLow: string
}> = {
  sunny: {
    background: 'linear-gradient(135deg, rgba(20,30,45,0.98) 0%, rgba(71,100,145,0.88) 100%)',
    border: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'rgba(245, 158, 11, 0.22)',
    badgeText: '#FDE68A',
    tempHigh: '#FDE68A',
    tempLow: '#E2E8F0',
  },
  cloudy: {
    background: 'linear-gradient(135deg, rgba(31,41,55,0.98) 0%, rgba(71,85,105,0.88) 100%)',
    border: 'rgba(203, 213, 225, 0.32)',
    badgeBg: 'rgba(148, 163, 184, 0.25)',
    badgeText: '#E2E8F0',
    tempHigh: '#F8FAFC',
    tempLow: '#CBD5E1',
  },
  rain: {
    background: 'linear-gradient(135deg, rgba(16,24,40,0.98) 0%, rgba(29,78,216,0.82) 100%)',
    border: 'rgba(96, 165, 250, 0.45)',
    badgeBg: 'rgba(96, 165, 250, 0.25)',
    badgeText: '#DBEAFE',
    tempHigh: '#F8FAFC',
    tempLow: '#DBEAFE',
  },
  storm: {
    background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(67,56,202,0.85) 100%)',
    border: 'rgba(250, 204, 21, 0.5)',
    badgeBg: 'rgba(250, 204, 21, 0.22)',
    badgeText: '#FDE68A',
    tempHigh: '#F8FAFC',
    tempLow: '#DBEAFE',
  },
  snow: {
    background: 'linear-gradient(135deg, rgba(16,30,44,0.98) 0%, rgba(56,189,248,0.72) 100%)',
    border: 'rgba(186, 230, 253, 0.55)',
    badgeBg: 'rgba(186, 230, 253, 0.28)',
    badgeText: '#E0F2FE',
    tempHigh: '#F8FAFC',
    tempLow: '#E0F2FE',
  },
  fog: {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(100,116,139,0.86) 100%)',
    border: 'rgba(209, 213, 219, 0.4)',
    badgeBg: 'rgba(209, 213, 219, 0.2)',
    badgeText: '#F8FAFC',
    tempHigh: '#F8FAFC',
    tempLow: '#E2E8F0',
  },
  windy: {
    background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(37,99,235,0.72) 100%)',
    border: 'rgba(191, 219, 254, 0.42)',
    badgeBg: 'rgba(191, 219, 254, 0.2)',
    badgeText: '#E0F2FE',
    tempHigh: '#F8FAFC',
    tempLow: '#DBEAFE',
  },
  night: {
    background: 'linear-gradient(135deg, rgba(10,15,29,0.98) 0%, rgba(30,41,59,0.92) 100%)',
    border: 'rgba(147, 197, 253, 0.32)',
    badgeBg: 'rgba(30, 41, 59, 0.55)',
    badgeText: '#DBEAFE',
    tempHigh: '#F8FAFC',
    tempLow: '#CBD5E1',
  },
}
