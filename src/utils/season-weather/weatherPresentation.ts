import type { DailyWeather } from './weatherProvider'
import { buildWeatherTags } from './weatherTagger'

export type WeatherVisualVariant =
  | 'sunny'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'windy'
  | 'night'

export interface WeatherPresentation {
  variant: WeatherVisualVariant
  label: string
  shortLabel: string
  isNight: boolean
}

const PRESENTATION_PRIORITY: WeatherVisualVariant[] = ['storm', 'snow', 'rain', 'fog', 'windy', 'cloudy', 'sunny', 'night']

const PRESENTATION_LABELS: Record<WeatherVisualVariant, { label: string; shortLabel: string }> = {
  sunny: { label: '晴れ', shortLabel: '晴' },
  cloudy: { label: 'くもり', shortLabel: '曇' },
  rain: { label: '雨', shortLabel: '雨' },
  storm: { label: '雷雨', shortLabel: '雷' },
  snow: { label: '雪', shortLabel: '雪' },
  fog: { label: '霧', shortLabel: '霧' },
  windy: { label: '風', shortLabel: '風' },
  night: { label: '夜空', shortLabel: '夜' },
}

export function resolvePrimaryWeatherState(weather: DailyWeather, hour = 12): WeatherVisualVariant {
  const tags = buildWeatherTags(weather, hour)
  for (const variant of PRESENTATION_PRIORITY) {
    if ((variant === 'night' && tags.includes('night')) || tags.includes(variant as 'sunny' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'windy' | 'fog')) {
      return variant
    }
  }

  return tags.includes('night') ? 'night' : 'sunny'
}

export function getWeatherPresentation(weather: DailyWeather, hour = 12): WeatherPresentation {
  const tags = buildWeatherTags(weather, hour)
  const variant = resolvePrimaryWeatherState(weather, hour)
  const labels = PRESENTATION_LABELS[variant]
  const rawLabel = weather.weatherText?.trim()
  const label = rawLabel && rawLabel.length <= 6 ? rawLabel : labels.label

  return {
    variant,
    label,
    shortLabel: labels.shortLabel,
    isNight: tags.includes('night'),
  }
}
