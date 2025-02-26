import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

import { themeCheckInterval, type ThemePresetName } from './constants'
import { applyPreset, isThemeLoaded, syncTheme } from './utils'

export const ThemeSync = ({ preset = null }: { preset: ThemePresetName }) => {
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [activePreset, setActivePreset] = useState(preset)
  const { resolvedTheme } = useTheme()

  // Update when preset changes
  useEffect(() => {
    if (preset !== activePreset) {
      setActivePreset(preset)
      if (themeLoaded && preset) {
        applyPreset(preset)
      }
    }
  }, [preset, activePreset, themeLoaded])

  // Listen for next-themes theme changes
  useEffect(() => {
    if (themeLoaded && !activePreset && resolvedTheme) {
      // When no preset is specified and next-themes theme changes, sync theme
      syncTheme()
    }
  }, [resolvedTheme, themeLoaded, activePreset])

  // Initialize theme and listen for VSCode theme changes
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!themeLoaded && isThemeLoaded()) {
        // If there is a specified preset, use it; otherwise use the dynamic preset
        if (activePreset) {
          applyPreset(activePreset)
        } else {
          syncTheme()
        }
        setThemeLoaded(true)
        clearInterval(intervalId)
      }
    }, themeCheckInterval)

    const styleObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'style' &&
          themeLoaded &&
          !activePreset // Only listen to theme changes when there is no specified preset
        ) {
          const style = getComputedStyle(document.documentElement)
          const newBackground = style.getPropertyValue(
            '--vscode-sideBarTitle-background'
          )
          if (newBackground) {
            syncTheme()
          }
        }
      }
    })

    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    })

    return () => {
      clearInterval(intervalId)
      styleObserver.disconnect()
    }
  }, [themeLoaded, activePreset])

  return null
}
