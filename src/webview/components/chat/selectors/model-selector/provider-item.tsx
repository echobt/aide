import React from 'react'
import { type AIProvider } from '@shared/entities'
import { cn } from '@webview/utils/common'

import { getProviderColor, getProviderIcon } from './constants'

export interface ProviderItemProps {
  provider: AIProvider
  isSelected: boolean
  onSelect: () => void
  onEdit: (provider: AIProvider) => void
}

export const ProviderItem: React.FC<ProviderItemProps> = ({
  provider,
  isSelected,
  onSelect,
  onEdit
}) => {
  // get provider icon and color
  const icon = getProviderIcon(provider.type, provider.name)
  const colorClass = getProviderColor(provider.type, provider.name)

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-md cursor-pointer',
        'transition-all duration-200 border border-transparent',
        'hover:border-border/50 hover:shadow-sm',
        isSelected
          ? 'bg-primary text-primary-foreground shadow-sm border-primary/50'
          : 'hover:translate-x-[2px] hover:bg-accent/80'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div
          className={cn(
            'size-4 shrink-0 rounded-full flex items-center justify-center text-foreground',
            colorClass
          )}
        >
          <span className="text-sm">{icon}</span>
        </div>
        <div className="flex-1 font-medium text-sm truncate max-w-[120px]">
          {provider.name}
        </div>
      </div>
      {/* <Button
        variant="ghost"
        size="iconXs"
        className={cn(
          'shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected
            ? 'opacity-100 hover:bg-primary-foreground/20'
            : 'hover:bg-primary/20'
        )}
        onClick={e => {
          e.stopPropagation()
          onEdit(provider)
        }}
      >
        <Pencil2Icon className="size-3" />
      </Button> */}
    </div>
  )
}
