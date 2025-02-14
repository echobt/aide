import { IFrameworkPreset } from '../types'
import { React19ShadcnPreset } from './react19-shadcn-preset'
import { Vue3ElementPlusPreset } from './vue3-element-plus-preset'

export const presetClasses: (new (...args: any[]) => IFrameworkPreset)[] = [
  React19ShadcnPreset,
  Vue3ElementPlusPreset
]
