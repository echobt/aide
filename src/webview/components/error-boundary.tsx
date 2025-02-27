import { useExportErrorLogs } from '@webview/hooks/api/use-export-error-logs'
import { AlertTriangle, FileText } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface FallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const { t } = useTranslation()
  const exportErrorLogs = useExportErrorLogs()

  const handleExportErrorLogs = () => {
    exportErrorLogs.mutate()
  }

  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>{t('webview.error.title')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2">
            <div className="text-sm text-destructive mb-4">{error.message}</div>
            <div className="text-sm text-muted-foreground">
              {t('webview.error.exportDescription')}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Separator />
        <AlertDialogFooter className="flex items-center gap-2 sm:justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportErrorLogs}
                disabled={exportErrorLogs.isPending}
              >
                <FileText className="h-4 w-4" />
                {t('webview.error.exportLogs')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('webview.error.exportLogsTooltip')}
            </TooltipContent>
          </Tooltip>
          <Button variant="destructive" onClick={resetErrorBoundary}>
            {t('webview.error.tryAgain')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Reusable ErrorBoundary component
export const AppErrorBoundary = ({
  children
}: {
  children: React.ReactNode
}) => (
  <ReactErrorBoundary
    FallbackComponent={ErrorFallback}
    onReset={() => {
      // Optional: Reset the app state here
      window.location.reload()
    }}
  >
    {children}
  </ReactErrorBoundary>
)
