import type { WeatherTag } from './weatherTagger'

export type IllustrationLayer =
  | 'sky-day'
  | 'sky-night'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog'
  | 'windy'

export function composeWeatherLayers(tags: WeatherTag[]): IllustrationLayer[] {
  const layers: IllustrationLayer[] = []
  const isNight = tags.includes('night')
  layers.push(isNight ? 'sky-night' : 'sky-day')
  layers.push(isNight ? 'moon' : 'sun')

  if (tags.includes('cloudy') || tags.includes('rain') || tags.includes('snow') || tags.includes('storm')) {
    layers.push('cloud')
  }
  if (tags.includes('rain')) layers.push('rain')
  if (tags.includes('snow')) layers.push('snow')
  if (tags.includes('storm')) layers.push('storm')
  if (tags.includes('fog')) layers.push('fog')
  if (tags.includes('windy')) layers.push('windy')

  return layers.slice(0, 8)
}
