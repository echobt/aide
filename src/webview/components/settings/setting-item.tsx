import { useEffect, useState } from 'react'
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import type {
  SettingConfigItem,
  SettingKey,
  SettingsSaveType
} from '@shared/entities'
import { useSettingContext } from '@webview/contexts/setting-cotext'
import { cn } from '@webview/utils/common'
import { Loader } from 'lucide-react'

import { SettingItemRenderer } from './setting-item-renderer'

export interface SettingItemProps {
  config: SettingConfigItem
  onSubmit?: (event: {
    key: string
    value: any
    saveType: SettingsSaveType
  }) => Promise<void>
  className?: string
}

export const SettingItem = ({
  config,
  onSubmit,
  className
}: SettingItemProps) => {
  const { getSetting, setSetting, getSettingState } = useSettingContext()
  const settingState = getSettingState(config.key as SettingKey)
  const [innerValue, setInnerValue] = useState(
    getSetting(config.key as SettingKey)
  )

  const settingValue = getSetting(config.key as SettingKey)

  useEffect(() => {
    if (settingValue !== innerValue) {
      setInnerValue(settingValue)
    }
  }, [settingValue])

  const handleChange = (newValue: any) => {
    setInnerValue(newValue)
  }

  const handleSubmit = async (newValue: any) => {
    setInnerValue(newValue)
    setSetting(config.key as SettingKey, newValue)
    onSubmit?.({ key: config.key, value: newValue, saveType: config.saveType })
  }

  const renderStatusIndicator = () => {
    switch (settingState.status) {
      case 'saving':
        return (
          <Loader className="animate-spin h-2 w-2 rounded-full bg-primary" />
        )
      case 'success':
        return <CheckIcon className="h-3 w-3 text-primary" />
      case 'error':
        return <Cross2Icon className="h-3 w-3 text-destructive" />
      case 'idle':
        return innerValue !== settingValue ? (
          <div className="h-2 w-2 rounded-full bg-primary" />
        ) : null
      default:
        return null
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium leading-none">
            {config.renderOptions.label}
          </label>
          {renderStatusIndicator()}
        </div>
      </div>
      <SettingItemRenderer
        value={innerValue}
        onChange={handleChange}
        onSubmit={handleSubmit}
        disabled={settingState.status === 'saving'}
        config={config}
      />
      {Boolean(config.renderOptions.description) && (
        <p className="text-sm text-muted-foreground">
          {config.renderOptions.description}
        </p>
      )}
    </div>
  )
}
