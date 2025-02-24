import { useState } from 'react'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import {
  BarChartIcon,
  DragHandleDots2Icon,
  EyeClosedIcon,
  EyeOpenIcon,
  GearIcon,
  LockClosedIcon
} from '@radix-ui/react-icons'
import { getAllAIProviderConfigMap, type AIProvider } from '@shared/entities'
import { BaseCard, type BaseCardAction } from '@webview/components/ui/base-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'

export const ProviderCard = ({
  provider,
  onEdit,
  onRemove,
  dragHandleProps,
  isSelected,
  onSelect,
  showUsage,
  onViewUsage
}: {
  provider: AIProvider
  onEdit: (provider: AIProvider) => void
  onRemove: (provider: AIProvider) => void
  dragHandleProps?: SyntheticListenerMap
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  showUsage?: boolean
  onViewUsage?: (provider: AIProvider) => void
}) => {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    {}
  )
  const aiProviderConfigs = getAllAIProviderConfigMap()

  const toggleFieldVisibility = (fieldKey: string) => {
    setVisibleFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }))
  }

  const renderField = (
    icon: React.ReactNode,
    label: string,
    content: React.ReactNode,
    isSecret?: boolean
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="text-muted-foreground/50">{icon}</div>
        <div className="text-[0.65rem] uppercase tracking-wider font-medium text-muted-foreground/60">
          {label}
        </div>
      </div>
      <div className="relative group/field">
        <div
          className={cn(
            'font-mono text-xs p-1.5 rounded-md transition-all duration-200',
            'bg-muted/40 border border-border/40 hover:border-border/60',
            isSecret && 'pr-7'
          )}
        >
          <div className="break-all">
            {isSecret && !visibleFields[label] ? (
              <span className="text-muted-foreground/50 select-none">
                ••••••••••••
              </span>
            ) : (
              <span className="text-muted-foreground/90">{content}</span>
            )}
          </div>
        </div>
        {isSecret && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleFieldVisibility(label)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity duration-200"
              >
                {visibleFields[label] ? (
                  <EyeOpenIcon className="h-3.5 w-3.5" />
                ) : (
                  <EyeClosedIcon className="h-3.5 w-3.5" />
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {visibleFields[label] ? 'Hide value' : 'Show value'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )

  const dragHandle = dragHandleProps && (
    <div
      {...dragHandleProps}
      className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors duration-200"
    >
      <DragHandleDots2Icon className="h-4 w-4 text-muted-foreground" />
    </div>
  )

  return (
    <BaseCard
      title={provider.name}
      badge={{
        text: aiProviderConfigs[provider.type]?.name || provider.type,
        variant: 'muted'
      }}
      isSelected={isSelected}
      onSelect={onSelect}
      onEdit={() => onEdit(provider)}
      onDelete={{
        title: 'Delete Provider',
        description: `Are you sure you want to delete provider "${provider.name}"?`,
        onConfirm: () => onRemove(provider)
      }}
      extraActions={
        [
          showUsage && {
            icon: <BarChartIcon className="h-3.5 w-3.5" />,
            label: 'View Usage',
            onClick: () => onViewUsage?.(provider),
            variant: 'default'
          }
        ].filter(Boolean) as BaseCardAction[]
      }
      dragHandleSlot={dragHandle}
    >
      <div className="grid gap-3 sm:grid-cols-2 mt-3">
        {Object.entries({
          ...provider.extraFields
        }).map(([key, value]) => {
          const fieldConfig = aiProviderConfigs[provider.type]?.fields.find(
            f => f.key === key
          )

          if (!fieldConfig) return null

          return (
            <div key={key}>
              {renderField(
                fieldConfig.isSecret ? (
                  <LockClosedIcon className="h-3.5 w-3.5" />
                ) : (
                  <GearIcon className="h-3.5 w-3.5" />
                ),
                fieldConfig.label,
                value,
                fieldConfig.isSecret
              )}
            </div>
          )
        })}
      </div>
    </BaseCard>
  )
}
