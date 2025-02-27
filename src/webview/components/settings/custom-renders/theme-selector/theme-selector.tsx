import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { useCustomTheme } from '@webview/contexts/theme-context'
import type { ThemePresetName } from '@webview/contexts/theme-context/constants'
import { useTranslation } from 'react-i18next'

const Default = 'default' as const

export const ThemeSelector = () => {
  const { t } = useTranslation()
  const { theme, availableThemes, setTheme, getThemeNameForDisplay } =
    useCustomTheme()

  // Handle theme change
  const handleThemeChange = (_value: string) => {
    const value = _value as ThemePresetName | typeof Default
    setTheme(value === Default ? null : value)
  }

  return (
    <Select value={theme || Default} onValueChange={handleThemeChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('webview.theme.selectTheme')} />
      </SelectTrigger>
      <SelectContent>
        {/* System theme (empty string) */}
        <SelectItem value={Default}>
          {t('webview.theme.followVSCode')}
        </SelectItem>

        {/* Preset themes */}
        {availableThemes
          .filter(Boolean) // Filter out the empty string (system theme)
          .map(theme => (
            <SelectItem key={theme} value={theme!}>
              {getThemeNameForDisplay(theme!)}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
