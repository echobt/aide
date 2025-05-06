import { useEffect, useState } from 'react'
import type { AIProvider } from '@shared/entities'
import { createAllAIProviderConfigMap } from '@shared/entities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import { logAndToastError } from '@webview/utils/common'
import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CreateProviderForm } from './provider-form/create-provider-form'
import { EditProviderForm } from './provider-form/edit-provider-form'

interface ProviderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProvider?: AIProvider
  onSubmit: (data: Partial<AIProvider>) => Promise<void>
}

export const ProviderFormDialog = ({
  open,
  onOpenChange,
  initialProvider,
  onSubmit
}: ProviderFormDialogProps) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false)
    }
  }, [open, initialProvider])

  // Add validation before submit
  const validateProvider = (provider: Partial<AIProvider>) => {
    if (!provider.type || !provider.name) {
      toast.error(t('webview.aiProvider.validation.typeAndNameRequired'))
      return false
    }

    const config = createAllAIProviderConfigMap(t)[provider.type]
    const missingFields = config.fields
      .filter(f => f.required)
      .filter(f => !provider.extraFields?.[f.key])

    if (missingFields.length > 0) {
      toast.error(
        t('webview.aiProvider.validation.missingRequiredFields', {
          fields: missingFields.map(f => f.label).join(', ')
        })
      )
      return false
    }

    return true
  }

  const handleSubmit = async (data: Partial<AIProvider>) => {
    if (!validateProvider(data)) return

    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onOpenChange(false)
    } catch (error) {
      handleError(error, t('webview.aiProvider.failedToSaveProvider'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleError = (error: unknown, message: string) => {
    if (error instanceof Error) {
      if (error.message.includes('duplicate')) {
        toast.error(t('webview.aiProvider.validation.providerNameExists'))
      } else if (error.message.includes('network')) {
        toast.error(t('webview.aiProvider.validation.networkError'))
      } else {
        logAndToastError(message, error)
      }
    } else {
      logAndToastError(message, error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-lg p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>
            {initialProvider
              ? t('webview.aiProvider.editModel')
              : t('webview.aiProvider.createModel')}
          </DialogTitle>
        </DialogHeader>

        {initialProvider ? (
          // Edit mode - Accordion layout
          <EditProviderForm
            isSubmitting={isSubmitting}
            initialProvider={initialProvider}
            onSubmit={handleSubmit}
          />
        ) : (
          // Create mode - Stepper layout
          <CreateProviderForm
            isSubmitting={isSubmitting}
            initialProvider={initialProvider}
            onSubmit={handleSubmit}
          />
        )}

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2Icon className="h-8 w-8 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
