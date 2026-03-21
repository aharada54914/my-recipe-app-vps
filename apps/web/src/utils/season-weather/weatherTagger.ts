import type { DailyWeather } from './weatherProvider'

export type WeatherTag = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'windy' | 'fog' | 'night'

export function buildWeatherTags(weather: DailyWeather, hour = 12): WeatherTag[] {
  const tags: WeatherTag[] = []
  const text = weather.weatherText ?? ''
  const code = weather.weatherCode ?? ''

  if (hour < 6 || hour >= 18) tags.push('night')

  if (text.includes('雷') || code.startsWith('2')) tags.push('storm')
  if (text.includes('雪')) tags.push('snow')
  if (text.includes('雨') || weather.precipitationMm >= 2 || code.startsWith('3')) tags.push('rain')
  if (text.includes('曇') || code.startsWith('2')) tags.push('cloudy')
  if (text.includes('霧')) tags.push('fog')
  if (text.includes('風')) tags.push('windy')

  if (!tags.includes('rain') && !tags.includes('snow') && !tags.includes('cloudy')) {
    tags.push('sunny')
  }

  return Array.from(new Set(tags))
}
