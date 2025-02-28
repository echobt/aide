import React, { createContext, useContext, useEffect } from 'react'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { useGlobalContext } from '../global-context'
import { themePresets, type ThemePresetName } from './constants'
import { ThemeSync } from './theme-sync'

interface ThemeContextType {
  theme: ThemePresetName
  setTheme: (theme: ThemePresetName) => void
  availableThemes: ThemePresetName[]
  getThemeNameForDisplay: (theme: ThemePresetName) => string
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeContextProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => {
  const { t } = useTranslation()
  const { setTheme: setNextTheme } = useTheme()
  const { invalidateQueries } = useInvalidateQueries()
  const { isDarkTheme } = useGlobalContext()

  const { data: theme } = useQuery({
    queryKey: ['theme'],
    queryFn: ({ signal }) =>
      api.actions().server.settings.getTheme({
        abortController: signalToController(signal),
        actionParams: {}
      }) as Promise<ThemePresetName>
  })

  const changeThemeMutation = useMutation({
    mutationFn: (theme: ThemePresetName) =>
      api.actions().server.settings.changeTheme({
        actionParams: { theme: theme || '' }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['theme']
      })
    }
  })

  useEffect(() => {
    setNextTheme(
      !theme
        ? isDarkTheme
          ? 'dark'
          : 'light'
        : theme.includes('dark')
          ? 'dark'
          : 'light'
    )
  }, [theme, isDarkTheme])

  const setTheme = (newTheme: ThemePresetName) => {
    setNextTheme(
      !newTheme ? 'system' : newTheme.includes('dark') ? 'dark' : 'light'
    )
    changeThemeMutation.mutate(newTheme)
  }

  const availableThemes: ThemePresetName[] = [
    null,
    ...(Object.keys(themePresets) as ThemePresetName[])
  ]
  const getThemeNameForDisplay = (theme: ThemePresetName) =>
    !theme
      ? t('webview.theme.followVSCode')
      : t(
          themePresets[theme]?.presetNameForDisplay ||
            'webview.theme.followVSCode'
        )
  const isAvailableTheme = (theme: ThemePresetName) =>
    availableThemes.includes(theme)

  return (
    <ThemeContext.Provider
      value={{
        theme: theme ?? null,
        setTheme,
        availableThemes,
        getThemeNameForDisplay
      }}
    >
      <ThemeSync preset={isAvailableTheme(theme || null) ? theme! : null} />
      {children}
    </ThemeContext.Provider>
  )
}

export const useCustomTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useCustomTheme must be used within a ThemeContextProvider')
  }
  return context
}
