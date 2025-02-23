import { useState } from 'react'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import {
  DragHandleDots2Icon,
  EyeClosedIcon,
  EyeOpenIcon
} from '@radix-ui/react-icons'
import { getAllAIProviderConfigMap, type AIProvider } from '@shared/entities'
import { BaseCard } from '@webview/components/ui/base-card'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'

export const ProviderCard = ({
  provider,
  onEdit,
  onRemove,
  dragHandleProps,
  isSelected,
  onSelect
}: {
  provider: AIProvider
  onEdit: (provider: AIProvider) => void
  onRemove: (provider: AIProvider) => void
  dragHandleProps?: SyntheticListenerMap
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
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
    label: string,
    content: React.ReactNode,
    className?: string
  ) => (
    <div className={cn('space-y-0.5', className)}>
      <div className="text-[0.65rem] uppercase tracking-wider font-medium text-muted-foreground/60">
        {label}
      </div>
      <div className="text-sm">{content}</div>
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
      dragHandleSlot={dragHandle}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries({
          ...provider.extraFields
        }).map(([key, value]) => {
          const fieldConfig = aiProviderConfigs[provider.type]?.fields.find(
            f => f.key === key
          )

          if (!fieldConfig) return null

          return renderField(
            fieldConfig.label,
            <div className="relative group/field">
              <div className="font-mono text-xs break-all p-1.5 bg-muted/40 rounded-md border border-border/40 transition-all duration-200 hover:border-primary/20">
                {fieldConfig.isSecret && !visibleFields[key]
                  ? '••••••••••••'
                  : value}
              </div>
              {fieldConfig.isSecret && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleFieldVisibility(key)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity duration-200"
                >
                  {visibleFields[key] ? (
                    <EyeOpenIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeClosedIcon className="h-3.5 w-3.5" />
                  )}
                </motion.button>
              )}
            </div>
          )
        })}
      </div>
    </BaseCard>
  )
}
