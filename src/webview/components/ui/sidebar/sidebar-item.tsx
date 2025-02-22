import React from 'react'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import type { IconProps } from '@radix-ui/react-icons/dist/types'
import { Button } from '@webview/components/ui/button'
import { Checkbox } from '@webview/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@webview/components/ui/dropdown-menu'
import { cn } from '@webview/utils/common'

import type { SidebarListRenderItemProps } from './sidebar-list'

export interface SidebarAction {
  label: string
  icon: React.ForwardRefExoticComponent<
    IconProps & React.RefAttributes<SVGSVGElement>
  >
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export interface SidebarItemProps<T> extends SidebarListRenderItemProps<T> {
  title: string
  isActive?: boolean
  onClick?: () => void
  actions?: SidebarAction[]
  className?: string
}

export function SidebarItem<T>({
  // Basic props
  // eslint-disable-next-line unused-imports/no-unused-vars
  item,
  dragHandleProps,
  onSelect,
  isSelected,
  isDragging,

  // other props
  title,
  isActive,
  onClick,
  actions = [],
  className
}: SidebarItemProps<T>) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between cursor-pointer hover:bg-secondary rounded-lg px-2',
        {
          'bg-secondary': isActive || isDragging
        },
        className
      )}
      onClick={onClick}
      {...dragHandleProps}
    >
      {onSelect && (
        <div
          className="flex items-center py-2"
          onClick={e => {
            e.stopPropagation()
            onSelect?.(!isSelected)
          }}
        >
          <Checkbox
            checked={isSelected}
            onClick={e => e.preventDefault()}
            className="translate-y-[1px] mr-2"
          />
        </div>
      )}
      <span className="truncate flex-1 py-2">{title}</span>
      {actions.length > 0 && (
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                className="hover:bg-transparent"
                onClick={e => e.stopPropagation()}
              >
                <DotsHorizontalIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {actions.map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={e => {
                    e.stopPropagation()
                    action.onClick(e)
                  }}
                  className={action.className}
                >
                  <action.icon className="mr-2 size-4" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
