import type { SettingPage, SettingsSaveType } from '@shared/entities'
import { cn } from '@webview/utils/common'

import { SettingItem } from './setting-item'

export interface SettingItemsPageProps {
  page: SettingPage
  onSubmit?: (event: {
    key: string
    value: any
    saveType: SettingsSaveType
  }) => Promise<void>
  className?: string
}

export const SettingItemsPage = ({
  page,
  onSubmit,
  className
}: SettingItemsPageProps) => {
  if (!page?.settings?.length) {
    return null
  }

  return (
    <div className={className}>
      <div>
        {page.settings.map((setting, i) => (
          <SettingItem
            key={setting.key}
            config={setting}
            onSubmit={onSubmit}
            className={cn(i !== 0 && 'border-t py-6', i === 1 && 'mt-6')}
          />
        ))}
      </div>
    </div>
  )
}
