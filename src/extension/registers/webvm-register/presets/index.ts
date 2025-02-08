import { IFrameworkPreset } from '../types'
import { React19ShadcnPreset } from './react19-shadcn-preset'
import { Vue3ElementPlusPreset } from './vue3-element-plus-preset'

const presets: IFrameworkPreset[] = [
  new Vue3ElementPlusPreset(),
  new React19ShadcnPreset()
]

export const presetNameMap = Object.fromEntries(
  presets.map(preset => [preset.getPresetName(), preset])
)
