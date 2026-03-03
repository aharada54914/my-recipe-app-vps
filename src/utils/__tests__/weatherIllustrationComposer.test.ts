import { describe, expect, it } from 'vitest'
import { composeWeatherLayers } from '../season-weather/weatherIllustrationComposer'

describe('composeWeatherLayers', () => {
  it('composes cloud + rain + storm layers in order', () => {
    const layers = composeWeatherLayers(['cloudy', 'rain', 'storm'])
    expect(layers[0]).toBe('sky-day')
    expect(layers).toContain('cloud')
    expect(layers).toContain('rain')
    expect(layers).toContain('storm')
  })

  it('uses moon layer at night', () => {
    const layers = composeWeatherLayers(['night'])
    expect(layers[0]).toBe('sky-night')
    expect(layers).toContain('moon')
  })
})
