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
  isFirstItem?: boolean
  config: SettingConfigItem
  onSubmit?: (event: {
    key: string
    value: any
    saveType: SettingsSaveType
  }) => Promise<void>
  className?: string
}

export const SettingItem = ({
  isFirstItem,
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
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10">
            <Loader className="animate-spin h-3 w-3 text-primary" />
            <span className="text-xs text-primary">saving...</span>
          </div>
        )
      case 'success':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10">
            <CheckIcon className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">saved</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/10">
            <Cross2Icon className="h-3 w-3 text-destructive" />
            <span className="text-xs text-destructive">failed</span>
          </div>
        )
      case 'idle':
        return innerValue !== settingValue ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs text-primary">unsaved</span>
          </div>
        ) : null
      default:
        return null
    }
  }

  const isAboutPage = config.key === 'about'

  const isSmallItem = [
    'selectInput',
    'modelSelector',
    'input',
    'textarea',
    'switch',
    'numberInput'
  ].includes(config.renderOptions.type)

  return (
    <div
      className={cn(
        'group relative transition-all duration-200',
        !isAboutPage && 'hover:bg-muted/30 rounded-lg -mx-4 px-4',
        className
      )}
    >
      {!isAboutPage && (
        <div
          className={cn(
            isFirstItem ? 'py-0' : 'py-6',
            isSmallItem
              ? 'flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-8'
              : 'flex flex-col gap-4'
          )}
        >
          {!config.renderOptions.hideLabel && (
            <div
              className={cn(
                'space-y-1.5',
                isSmallItem
                  ? 'w-full md:w-[260px] lg:w-[280px] xl:w-[320px]'
                  : 'w-full max-w-2xl'
              )}
            >
              <div className="flex items-center gap-3">
                <label className="text-base font-medium leading-none tracking-tight">
                  {config.renderOptions.label}
                </label>
                {renderStatusIndicator()}
              </div>
              {Boolean(config.renderOptions.description) && (
                <p className="text-sm text-muted-foreground/80 leading-relaxed">
                  {config.renderOptions.description}
                </p>
              )}
            </div>
          )}
          <div
            className={cn(
              'w-full',
              isSmallItem && 'md:w-[300px] lg:w-[320px] xl:w-[360px]',
              !isSmallItem && 'max-w-4xl'
            )}
          >
            <SettingItemRenderer
              value={innerValue}
              onChange={handleChange}
              onSubmit={handleSubmit}
              disabled={settingState.status === 'saving'}
              config={config}
            />
          </div>
        </div>
      )}
      {isAboutPage && (
        <SettingItemRenderer
          value={innerValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          disabled={settingState.status === 'saving'}
          config={config}
        />
      )}
    </div>
  )
}
