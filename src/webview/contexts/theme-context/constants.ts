// theme check interval
export const themeCheckInterval = 100

// VSCode variable mapping to custom theme variable
export const themeMapping = {
  '--color-background': '--vscode-sideBarTitle-background',
  '--color-foreground': '--vscode-sideBarTitle-foreground',
  '--color-title': '--vscode-sideBarTitle-background',
  '--color-title-foreground': '--vscode-sideBarTitle-foreground',
  '--color-primary': '--vscode-button-background',
  '--color-primary-foreground': '--vscode-button-foreground',
  '--color-destructive': '--vscode-errorForeground',
  '--color-destructive-foreground': '--vscode-editor-foreground',
  '--radius': '0.5rem'
}

// adjustment presets - use when no specific colors are provided
export const adjustmentPresets = {
  dark: {
    '--color-card': 0.02,
    '--color-card-foreground': -0.02,
    '--color-popover': -0.02,
    '--color-popover-foreground': 0.02,
    '--color-secondary': 0.05,
    '--color-secondary-foreground': -0.05,
    '--color-muted': -0.07,
    '--color-muted-foreground': -0.1,
    '--color-accent': 0.07,
    '--color-accent-foreground': -0.07,
    '--color-border': 0.1,
    '--color-input': 0.05,
    '--color-ring': 0.1
  },
  light: {
    '--color-card': -0.02,
    '--color-card-foreground': 0.02,
    '--color-popover': 0.02,
    '--color-popover-foreground': -0.02,
    '--color-secondary': -0.05,
    '--color-secondary-foreground': 0.05,
    '--color-muted': 0.07,
    '--color-muted-foreground': 0.1,
    '--color-accent': -0.07,
    '--color-accent-foreground': 0.07,
    '--color-border': -0.1,
    '--color-input': -0.05,
    '--color-ring': -0.1
  }
}

export type AdjustmentPresetName = keyof typeof adjustmentPresets

export type BaseColors = {
  '--color-background': string
  '--color-foreground': string
  '--color-title'?: string
  '--color-title-foreground'?: string
  '--color-primary': string
  '--color-primary-foreground': string
  '--color-destructive'?: string
  '--color-destructive-foreground'?: string
}

// theme preset library type definition
export type ThemePreset = {
  adjustmentPresetName: AdjustmentPresetName
  presetNameForDisplay: string
  baseColors: BaseColors
}

// theme preset library - store user defined theme presets
export const themePresets = {
  // dark themes
  darkSlate: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkSlate',
    baseColors: {
      '--color-background': '#09090b',
      '--color-foreground': '#e2e2e5',
      '--color-primary': '#8b5cf6',
      '--color-primary-foreground': '#ffffff'
    }
  },
  darkZinc: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkZinc',
    baseColors: {
      '--color-background': '#18181b',
      '--color-foreground': '#f4f4f5',
      '--color-primary': '#0ea5e9',
      '--color-primary-foreground': '#f8fafc'
    }
  },
  darkRose: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkRose',
    baseColors: {
      '--color-background': '#1c1917',
      '--color-foreground': '#f5f5f4',
      '--color-primary': '#e11d48',
      '--color-primary-foreground': '#fff1f2'
    }
  },
  darkEmerald: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkEmerald',
    baseColors: {
      '--color-background': '#0f172a',
      '--color-foreground': '#f8fafc',
      '--color-primary': '#10b981',
      '--color-primary-foreground': '#f0fdfa'
    }
  },
  darkViolet: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkViolet',
    baseColors: {
      '--color-background': '#1e1b4b',
      '--color-foreground': '#e0e7ff',
      '--color-primary': '#a855f7',
      '--color-primary-foreground': '#faf5ff'
    }
  },
  darkCrimson: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.darkCrimson',
    baseColors: {
      '--color-background': '#020617',
      '--color-foreground': '#f1f5f9',
      '--color-primary': '#f43f5e',
      '--color-primary-foreground': '#fff1f2'
    }
  },

  // light themes
  lightGray: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.lightGray',
    baseColors: {
      '--color-background': '#f9fafb',
      '--color-foreground': '#111827',
      '--color-primary': '#6366f1',
      '--color-primary-foreground': '#ffffff'
    }
  },
  lightSky: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.lightSky',
    baseColors: {
      '--color-background': '#f8fafc',
      '--color-foreground': '#0f172a',
      '--color-primary': '#0284c7',
      '--color-primary-foreground': '#f0f9ff'
    }
  },
  lightTeal: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.lightTeal',
    baseColors: {
      '--color-background': '#f0fdfa',
      '--color-foreground': '#134e4a',
      '--color-primary': '#0d9488',
      '--color-primary-foreground': '#f0fdfa'
    }
  },
  lightAmber: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.lightAmber',
    baseColors: {
      '--color-background': '#fffbeb',
      '--color-foreground': '#78350f',
      '--color-primary': '#d97706',
      '--color-primary-foreground': '#fffbeb'
    }
  },
  lightRose: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.lightRose',
    baseColors: {
      '--color-background': '#fff1f2',
      '--color-foreground': '#881337',
      '--color-primary': '#e11d48',
      '--color-primary-foreground': '#fff1f2'
    }
  },

  // special themes
  midnight: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.midnight',
    baseColors: {
      '--color-background': '#0f1729',
      '--color-foreground': '#e2e8f0',
      '--color-primary': '#3b82f6',
      '--color-primary-foreground': '#eff6ff'
    }
  },
  sunset: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.sunset',
    baseColors: {
      '--color-background': '#27272a',
      '--color-foreground': '#fafafa',
      '--color-primary': '#f97316',
      '--color-primary-foreground': '#fff7ed'
    }
  },
  forest: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.forest',
    baseColors: {
      '--color-background': '#14532d',
      '--color-foreground': '#ecfdf5',
      '--color-primary': '#22c55e',
      '--color-primary-foreground': '#f0fdf4'
    }
  },
  ocean: {
    adjustmentPresetName: 'dark',
    presetNameForDisplay: 'webview.theme.ocean',
    baseColors: {
      '--color-background': '#0c4a6e',
      '--color-foreground': '#f0f9ff',
      '--color-primary': '#0ea5e9',
      '--color-primary-foreground': '#e0f2fe'
    }
  },
  candy: {
    adjustmentPresetName: 'light',
    presetNameForDisplay: 'webview.theme.candy',
    baseColors: {
      '--color-background': '#fdf4ff',
      '--color-foreground': '#701a75',
      '--color-primary': '#d946ef',
      '--color-primary-foreground': '#fdf4ff'
    }
  }
} as const satisfies Record<string, ThemePreset>

export type ThemePresetName = keyof typeof themePresets | null
