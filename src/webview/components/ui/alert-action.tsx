import { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@webview/components/ui/alert-dialog'
import { cn } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

interface AlertActionProps {
  // Trigger element props
  children: ReactNode
  className?: string
  asChild?: boolean

  // Alert dialog props
  title?: string
  description?: string
  cancelText?: string
  confirmText?: string
  variant?: 'default' | 'destructive'
  disabled?: boolean

  // Callbacks
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

export const AlertAction = ({
  // Trigger props
  children,
  className,
  asChild = true,

  // Alert dialog props
  title,
  description,
  cancelText,
  confirmText,
  variant = 'default',
  disabled = false,

  // Callbacks
  onConfirm,
  onCancel
}: AlertActionProps) => {
  const { t } = useTranslation()

  const defaultTitle = t('webview.alertAction.areYouSure')
  const defaultDescription = t('webview.alertAction.cannotBeUndone')
  const defaultCancelText = t('webview.alertAction.cancel')
  const defaultConfirmText = t('webview.alertAction.continue')

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild={asChild} disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent
        className={cn('w-[calc(100vw-2rem)] rounded-lg', className)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {cancelText || defaultCancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              variant === 'destructive' &&
                'bg-destructive hover:bg-destructive/90'
            )}
          >
            {confirmText || defaultConfirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
