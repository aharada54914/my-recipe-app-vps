import type { DailyWeather } from '../../utils/season-weather/weatherProvider'
import { buildWeatherTags } from '../../utils/season-weather/weatherTagger'
import { composeWeatherLayers } from '../../utils/season-weather/weatherIllustrationComposer'
import { WEATHER_COLORS } from './weatherIllustrationTokens'

export function WeatherIllustration({ weather, size = 52 }: { weather: DailyWeather, size?: number }) {
  const tags = buildWeatherTags(weather)
  const layers = composeWeatherLayers(tags)
  const stormStrong = layers.includes('storm')
  const snowStrong = layers.includes('snow')

  return (
    <svg width={size} height={size} viewBox="0 0 52 52" role="img" aria-label={`weather-${tags.join('-')}`}>
      {layers.includes('sky-day') && <rect x="0" y="0" width="52" height="52" rx="10" fill={WEATHER_COLORS.skyDay} />}
      {layers.includes('sky-night') && <rect x="0" y="0" width="52" height="52" rx="10" fill={WEATHER_COLORS.skyNight} />}
      {layers.includes('sun') && <circle cx="38" cy="14" r="7" fill={WEATHER_COLORS.sun} />}
      {layers.includes('moon') && <circle cx="38" cy="14" r="7" fill={WEATHER_COLORS.moon} />}
      {layers.includes('cloud') && <ellipse cx="24" cy="27" rx="14" ry="8" fill={WEATHER_COLORS.cloud} />}
      {layers.includes('rain') && <>
        <line x1="16" y1="34" x2="13" y2="41" stroke={WEATHER_COLORS.rain} strokeWidth="2" />
        <line x1="24" y1="34" x2="21" y2="41" stroke={WEATHER_COLORS.rain} strokeWidth="2" />
        <line x1="32" y1="34" x2="29" y2="41" stroke={WEATHER_COLORS.rain} strokeWidth="2" />
      </>}
      {layers.includes('snow') && <>
        <circle cx="18" cy="39" r="2" fill={snowStrong ? '#B5E9FF' : WEATHER_COLORS.snow} />
        <circle cx="26" cy="41" r="2" fill={snowStrong ? '#B5E9FF' : WEATHER_COLORS.snow} />
        <circle cx="33" cy="38" r="2" fill={snowStrong ? '#B5E9FF' : WEATHER_COLORS.snow} />
      </>}
      {layers.includes('storm') && <polygon points="24,33 19,43 25,43 21,49 33,37 27,37 30,33" fill={stormStrong ? '#FFE14A' : WEATHER_COLORS.storm} />}
      {layers.includes('fog') && <>
        <line x1="9" y1="38" x2="43" y2="38" stroke={WEATHER_COLORS.fog} strokeWidth="2" />
        <line x1="9" y1="42" x2="43" y2="42" stroke={WEATHER_COLORS.fog} strokeWidth="2" />
      </>}
      {layers.includes('windy') && <>
        <path d="M10 18 Q24 12 38 18" stroke={WEATHER_COLORS.windy} strokeWidth="2" fill="none" />
        <path d="M8 22 Q20 18 32 22" stroke={WEATHER_COLORS.windy} strokeWidth="2" fill="none" />
      </>}
    </svg>
  )
}
