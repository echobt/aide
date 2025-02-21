import type { SettingPage, SettingsSaveType } from '@shared/entities'

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
      <div className="space-y-6">
        {page.settings.map(setting => (
          <SettingItem key={setting.key} config={setting} onSubmit={onSubmit} />
        ))}
      </div>
    </div>
  )
}
