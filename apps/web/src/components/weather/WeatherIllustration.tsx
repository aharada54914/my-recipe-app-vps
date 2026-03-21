import type { DailyWeather } from '../../utils/season-weather/weatherProvider'
import { getWeatherPresentation } from '../../utils/season-weather/weatherPresentation'
import { WEATHER_COLORS } from './weatherIllustrationTokens'

function CloudShape() {
  return (
    <>
      <ellipse cx="22" cy="28" rx="10" ry="7" fill={WEATHER_COLORS.cloudDark} stroke={WEATHER_COLORS.iconOutline} strokeWidth="1.5" />
      <ellipse cx="31" cy="27" rx="10" ry="8" fill={WEATHER_COLORS.cloudLight} stroke={WEATHER_COLORS.iconOutline} strokeWidth="1.5" />
      <ellipse cx="16" cy="30" rx="8" ry="6" fill={WEATHER_COLORS.cloudLight} stroke={WEATHER_COLORS.iconOutline} strokeWidth="1.5" />
      <rect x="14" y="28" width="24" height="9" rx="4.5" fill={WEATHER_COLORS.cloudLight} stroke={WEATHER_COLORS.iconOutline} strokeWidth="1.5" />
    </>
  )
}

export function WeatherIllustration({ weather, size = 52 }: { weather: DailyWeather, size?: number }) {
  const presentation = getWeatherPresentation(weather)
  const isNight = presentation.isNight

  return (
    <svg width={size} height={size} viewBox="0 0 52 52" role="img" aria-label={`weather-${presentation.variant}`}>
      <defs>
        <linearGradient id="weather-tile-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isNight ? '#10203E' : '#133C73'} />
          <stop offset="100%" stopColor={isNight ? '#1E335A' : '#2A6EC6'} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="50" height="50" rx="12" fill="url(#weather-tile-bg)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />

      {isNight ? (
        <>
          <circle cx="39" cy="13" r="7" fill={WEATHER_COLORS.moonGlow} opacity="0.3" />
          <path d="M38 7c-2.8 1-4.8 3.7-4.8 6.8 0 4 3.2 7.2 7.2 7.2 1.2 0 2.3-.3 3.3-.8-1.2 2.4-3.7 4-6.6 4-4.1 0-7.4-3.3-7.4-7.4 0-4 3.2-7.2 7.1-7.3.4 0 .8 0 1.2.1Z" fill={WEATHER_COLORS.moon} />
        </>
      ) : (
        <>
          <circle cx="39" cy="13" r="8.5" fill={WEATHER_COLORS.sunGlow} opacity="0.28" />
          <circle cx="39" cy="13" r="5.8" fill={WEATHER_COLORS.sun} />
        </>
      )}

      {(presentation.variant === 'cloudy' || presentation.variant === 'rain' || presentation.variant === 'storm' || presentation.variant === 'snow' || presentation.variant === 'fog' || presentation.variant === 'windy') && (
        <CloudShape />
      )}

      {presentation.variant === 'sunny' && (
        <>
          <path d="M12 34h22" stroke="rgba(255,255,255,0.24)" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 39h18" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {presentation.variant === 'rain' && (
        <>
          <line x1="16" y1="37" x2="13" y2="45" stroke={WEATHER_COLORS.rain} strokeWidth="3" strokeLinecap="round" />
          <line x1="25" y1="37" x2="22" y2="45" stroke={WEATHER_COLORS.rain} strokeWidth="3" strokeLinecap="round" />
          <line x1="34" y1="37" x2="31" y2="45" stroke={WEATHER_COLORS.rain} strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {presentation.variant === 'storm' && (
        <>
          <line x1="16" y1="37" x2="13" y2="45" stroke={WEATHER_COLORS.rain} strokeWidth="3" strokeLinecap="round" />
          <line x1="34" y1="37" x2="31" y2="45" stroke={WEATHER_COLORS.rain} strokeWidth="3" strokeLinecap="round" />
          <path d="M25 35 20 45h6l-3 7 10-12h-6l3-5Z" fill={WEATHER_COLORS.storm} stroke="#FEF08A" strokeWidth="1" strokeLinejoin="round" />
        </>
      )}

      {presentation.variant === 'snow' && (
        <>
          {[17, 26, 35].map((x) => (
            <g key={x} transform={`translate(${x} 40)`}>
              <path d="M0 -3 V3 M-3 0 H3 M-2.2 -2.2 2.2 2.2 M-2.2 2.2 2.2 -2.2" stroke={WEATHER_COLORS.snowOutline} strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="0" cy="0" r="0.7" fill={WEATHER_COLORS.snow} />
            </g>
          ))}
        </>
      )}

      {presentation.variant === 'fog' && (
        <>
          <path d="M10 36h28" stroke={WEATHER_COLORS.fog} strokeWidth="3" strokeLinecap="round" />
          <path d="M13 41h24" stroke={WEATHER_COLORS.fog} strokeWidth="3" strokeLinecap="round" />
          <path d="M16 46h20" stroke={WEATHER_COLORS.fog} strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {presentation.variant === 'windy' && (
        <>
          <path d="M10 21c6-4 12-4 18-.5 2.4 1.3 4.8.9 6.2-1.2 1.2-1.8.6-4.1-1.2-5.1" stroke={WEATHER_COLORS.windy} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M9 28c6-3.5 12-3.2 18 .4 2 1.2 4.5 1.1 6-.6" stroke={WEATHER_COLORS.windy} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M11 35c5-2.2 10-2 14 .2 1.5.8 3 .7 4.2-.5" stroke={WEATHER_COLORS.windy} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
