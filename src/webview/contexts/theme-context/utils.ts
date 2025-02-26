import { logger } from '@webview/utils/logger'
import { hsla, parseToHsla } from 'color2k'

import {
  adjustmentPresets,
  themeMapping,
  themePresets,
  type AdjustmentPresetName,
  type BaseColors,
  type ThemePreset,
  type ThemePresetName
} from './constants'

/**
 * adjust color brightness
 * @param color color value
 * @param amount adjustment amount
 * @returns adjusted HSLA value
 */
export const adjustLightness = (color: string, amount: number) => {
  const [h, s, l, a] = parseToHsla(color)
  const newL = Math.max(0, Math.min(1, l + amount))
  return [h, s, newL, a] as const
}

/**
 * determine if the color is light
 * @param color color value
 * @returns whether the color is light
 */
export const isLightColor = (color: string) => {
  const [, , l] = parseToHsla(color)
  return l > 0.5
}

/**
 * convert preset to theme
 * @param adjustmentPresetName - adjustment preset name
 * @param baseColors - base colors (for adjustment presets)
 * @returns calculated theme variables
 */
export const presetToCssVarsMap = (
  adjustmentPresetName: AdjustmentPresetName,
  _baseColors: BaseColors,
  forceAdjustmentPresets = false
): Record<string, string> => {
  const baseColors = Object.fromEntries(
    Object.entries(_baseColors).map(([key, value]) => [
      key,
      value ? convertHexToHsl(value) : undefined
    ])
  ) as BaseColors

  // check if adjustment preset exists
  if (
    !baseColors['--color-background'] ||
    !baseColors['--color-foreground'] ||
    !baseColors['--color-primary']
  ) {
    logger.warn('Base colors are required for adjustment presets')
    return {}
  }

  const preset =
    adjustmentPresets[adjustmentPresetName as keyof typeof adjustmentPresets]
  const result: Record<string, string> = {
    ...baseColors
  }

  Object.entries(preset).forEach(([key, amount]) => {
    try {
      const color = baseColors[key as keyof BaseColors]
      let [h, s, l, a] = parseToHsla(
        typeof color === 'string' ? color : baseColors['--color-background']
      )

      if (!color || forceAdjustmentPresets) {
        switch (key) {
          case '--color-ring':
            ;[h, s, l, a] = adjustLightness(
              baseColors['--color-primary'],
              amount
            )
            break
          case '--color-card-foreground':
          case '--color-popover-foreground':
          case '--color-secondary-foreground':
          case '--color-muted-foreground':
          case '--color-accent-foreground':
            ;[h, s, l, a] = adjustLightness(
              baseColors['--color-foreground'],
              amount
            )
            break
          default:
            ;[h, s, l, a] = adjustLightness(
              baseColors['--color-background'],
              amount
            )
        }
      }

      const hslString = hsla(h, s, l, a)
      const hslValues = hslString.match(/\d+(\.\d+)?/g)
      if (hslValues && hslValues.length >= 3) {
        const value = `${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}%`
        result[key] = `hsl(${value})`
      }
    } catch (error) {
      logger.warn(`Failed to parse color for ${key}`, error)
    }
  })

  return result
}

/**
 * parse dynamic preset - automatically select the appropriate preset based on the VSCode theme
 * @param themeVars - VSCode theme variables
 * @returns parsed theme variables
 */
export const parseDynamicPresetToCssVars = (
  themeVars: BaseColors
): Record<string, string> => {
  const background = themeVars['--color-background']
  const foreground = themeVars['--color-foreground']
  const primary = themeVars['--color-primary']

  if (!background || !foreground || !primary) {
    logger.warn('Required theme variables are missing')
    return {}
  }

  const isLightTheme = isLightColor(background)
  const adjustmentPresetName = isLightTheme ? 'light' : 'dark'

  return presetToCssVarsMap(adjustmentPresetName, themeVars, true)
}

/**
 * Convert hex color to HSL format
 * @param color - color in hex or hsl format
 * @returns color in hsl format
 */
export const convertHexToHsl = (color: string): string => {
  // If already in HSL format, return as is
  if (color.startsWith('hsl')) {
    return color
  }

  try {
    const [h, s, l] = parseToHsla(color)
    return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
  } catch (error) {
    logger.warn(`Failed to convert color: ${color}`, error)
    return color
  }
}

/**
 * apply the specified preset
 * @param presetName - preset name
 */
export const applyPreset = (presetName: ThemePresetName): void => {
  if (!presetName) return
  const preset = themePresets[presetName] as ThemePreset

  const cssVars = presetToCssVarsMap(
    preset.adjustmentPresetName,
    preset.baseColors
  )
  applyThemeToDOM(cssVars)
}

/**
 * apply theme variables to DOM
 * @param cssVars - theme variables object
 */
export const applyThemeToDOM = (cssVars: Record<string, string>): void => {
  Object.entries(cssVars).forEach(([key, value]) => {
    if (value) {
      document.body.style.setProperty(key, value)
    }
  })
}

/**
 * check if the theme is loaded
 * @returns whether the theme is loaded
 */
export const isThemeLoaded = (): boolean => {
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue('--vscode-button-foreground') !== ''
}

/**
 * sync theme - calculate from VSCode theme variables and apply theme
 */
export const syncTheme = (): void => {
  const style = getComputedStyle(document.documentElement)
  const themeVars = Object.fromEntries(
    Object.entries(themeMapping).map(([key, cssVar]) => [
      key,
      style.getPropertyValue(cssVar)
    ])
  )

  // use dynamic preset to parse
  const cssVars = parseDynamicPresetToCssVars(themeVars as BaseColors)

  // apply theme variables to DOM
  applyThemeToDOM(cssVars)
}
