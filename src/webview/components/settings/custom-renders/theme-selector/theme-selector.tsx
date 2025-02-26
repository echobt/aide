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

const Default = 'default' as const

export const ThemeSelector = () => {
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
        <SelectValue placeholder="Select a theme" />
      </SelectTrigger>
      <SelectContent>
        {/* System theme (empty string) */}
        <SelectItem value={Default}>Follow VS Code</SelectItem>

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
