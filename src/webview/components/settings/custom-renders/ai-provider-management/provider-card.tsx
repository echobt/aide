import { useState } from 'react'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import {
  DragHandleDots2Icon,
  EyeClosedIcon,
  EyeOpenIcon,
  Pencil2Icon,
  TrashIcon
} from '@radix-ui/react-icons'
import { getAllAIProviderConfigMap, type AIProvider } from '@shared/entities'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Card, CardContent } from '@webview/components/ui/card'
import { Checkbox } from '@webview/components/ui/checkbox'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Card withEffect>
        <CardContent className="p-3 relative">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {onSelect && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={onSelect}
                    className="translate-y-px"
                  />
                )}
                {dragHandleProps && (
                  <div
                    {...dragHandleProps}
                    className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors duration-200"
                  >
                    <DragHandleDots2Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base text-foreground truncate group-hover:text-primary transition-colors duration-200">
                    {provider.name}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-muted/60 rounded-full text-muted-foreground/70 shrink-0">
                    {aiProviderConfigs[provider.type]?.name || provider.type}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-7 w-7 p-0 rounded-md inline-flex items-center justify-center hover:bg-primary/5 hover:text-primary transition-colors duration-200"
                onClick={() => onEdit(provider)}
              >
                <Pencil2Icon className="h-3.5 w-3.5" />
              </motion.button>

              <AlertAction
                title="Delete Provider"
                description={`Are you sure you want to delete provider "${provider.name}"?`}
                variant="destructive"
                confirmText="Delete"
                onConfirm={() => onRemove(provider)}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-7 w-7 p-0 rounded-md inline-flex items-center justify-center hover:bg-destructive/5 text-destructive hover:text-destructive transition-colors duration-200"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </motion.button>
              </AlertAction>
            </div>
          </div>

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
        </CardContent>
      </Card>
    </motion.div>
  )
}
