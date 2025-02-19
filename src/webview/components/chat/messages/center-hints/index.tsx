import { ModelSettingHint } from './model-setting-hint'
import { PresetSelector } from './preset-selector'

export const CenterHints = () => (
  <div className="flex flex-col flex-1 h-full items-center justify-center gap-4">
    <ModelSettingHint />
    <PresetSelector />
  </div>
)
