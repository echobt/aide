import { type ReactNode } from 'react'
import { Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Card, CardContent } from '@webview/components/ui/card'
import { Checkbox } from '@webview/components/ui/checkbox'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export interface BaseCardAction {
  icon: ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
}

export interface BaseCardProps {
  // Basic props
  title: string
  subtitle?: string
  badge?: {
    text: string
    variant?: 'default' | 'muted'
  }

  // Selection props
  isSelected?: boolean
  onSelect?: (selected: boolean) => void

  // Action props
  onEdit?: () => void
  onDelete?: {
    title: string
    description: string
    onConfirm: () => void
  }
  extraActions?: BaseCardAction[]

  // Slot props
  dragHandleSlot?: ReactNode
  actionLeftSlot?: ReactNode

  // Content props
  children?: ReactNode

  // Style props
  className?: string
  contentClassName?: string
}

export const BaseCard = ({
  // Basic props
  title,
  subtitle,
  badge,

  // Selection props
  isSelected,
  onSelect,

  // Action props
  onEdit,
  onDelete,
  extraActions = [],

  // Slot props
  dragHandleSlot,
  actionLeftSlot,

  // Content props
  children,

  // Style props
  className,
  contentClassName
}: BaseCardProps) => {
  const { t } = useTranslation()
  const renderActions = () => {
    const actions = []

    // Add extra actions
    actions.push(
      ...extraActions.map((action, index) => (
        <ButtonWithTooltip
          key={`extra-${index}`}
          variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
          size="sm"
          tooltip={action.label}
          className={cn(
            'h-7 w-7 p-0 transition-colors duration-200',
            action.variant === 'destructive'
              ? 'hover:bg-destructive/5 text-destructive hover:text-destructive'
              : 'hover:bg-primary/5 hover:text-primary'
          )}
          onClick={action.onClick}
        >
          {action.icon}
        </ButtonWithTooltip>
      ))
    )

    // Add edit action if provided
    if (onEdit) {
      actions.push(
        <ButtonWithTooltip
          key="edit"
          variant="ghost"
          size="sm"
          tooltip={t('webview.common.edit')}
          className="h-7 w-7 p-0 hover:bg-primary/5 hover:text-primary transition-colors duration-200"
          onClick={onEdit}
        >
          <Pencil2Icon className="h-3.5 w-3.5" />
        </ButtonWithTooltip>
      )
    }

    // Add delete action if provided
    if (onDelete) {
      actions.push(
        <AlertAction
          key="delete"
          title={onDelete.title}
          description={onDelete.description}
          variant="destructive"
          confirmText={t('webview.common.delete')}
          onConfirm={onDelete.onConfirm}
        >
          <ButtonWithTooltip
            variant="ghost"
            size="sm"
            tooltip={t('webview.common.delete')}
            className="h-7 w-7 p-0 hover:bg-destructive/5 text-destructive hover:text-destructive transition-colors duration-200"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </ButtonWithTooltip>
        </AlertAction>
      )
    }

    return actions
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('group h-full', className)}
    >
      <Card withEffect>
        <CardContent className={cn('p-3', contentClassName)}>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {dragHandleSlot}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {onSelect && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={onSelect}
                      className="translate-y-px overflow-hidden mr-2"
                    />
                  )}
                  <span className="font-medium text-base text-foreground truncate group-hover:text-primary transition-colors duration-200">
                    {title}
                  </span>
                  {badge && (
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full shrink-0',
                        badge.variant === 'muted'
                          ? 'bg-muted/60 text-muted-foreground/70'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {badge.text}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {actionLeftSlot}
              <div className="flex items-center gap-1.5">{renderActions()}</div>
            </div>
          </div>

          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
