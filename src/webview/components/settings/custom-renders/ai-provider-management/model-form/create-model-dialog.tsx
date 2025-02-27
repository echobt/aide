import { useState } from 'react'
import { Button } from '@webview/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import { Textarea } from '@webview/components/ui/textarea'
import { useTranslation } from 'react-i18next'

interface CreateModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (modelNames: string[]) => void
}

export const CreateModelDialog = ({
  open,
  onOpenChange,
  onSubmit
}: CreateModelDialogProps) => {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    const modelNames = input
      .split('\n')
      .map(name => name.trim())
      .filter(Boolean)
    onSubmit(modelNames)
    setInput('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>{t('webview.aiProvider.addModels')}</DialogTitle>
          <DialogDescription>
            {t('webview.aiProvider.enterModelNamesOneLine')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            placeholder={t('webview.aiProvider.modelNamesPlaceholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            className="min-h-[200px]"
          />
          <Button onClick={handleSubmit} className="w-full">
            {t('webview.aiProvider.addModels')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
