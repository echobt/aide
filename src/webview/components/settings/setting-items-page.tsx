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
  const isAboutPage = page.id === 'about'

  if (!page?.settings?.length) {
    return null
  }

  return (
    <div className={cn(className)}>
      {!isAboutPage && page.label && (
        <div className="flex flex-col gap-1 mb-4">
          <h2 className="text-2xl text-foreground font-bold">{page.label}</h2>
        </div>
      )}
      <div className="divide-y divide-border/40">
        {page.settings.map((setting, i) => (
          <SettingItem
            key={setting.key}
            config={setting}
            isFirstItem={i === 0}
            onSubmit={onSubmit}
            className={cn('transition-colors duration-200', i === 0 && 'pt-0')}
          />
        ))}
      </div>
    </div>
  )
}
