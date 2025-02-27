import { CircleIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons'
import type { AIProvider } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@webview/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import { Progress } from '@webview/components/ui/progress'
import { Skeleton } from '@webview/components/ui/skeleton'
import { api } from '@webview/network/actions-api'
import { useTranslation } from 'react-i18next'

interface ProviderUsageDialogProps {
  provider?: AIProvider
  onOpenChange: (open: boolean) => void
}

// Utility functions for formatting
const formatNumber = (num?: number) => {
  if (num === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US').format(num)
}

const formatCurrency = (amount?: number, currency: string = 'USD') => {
  if (amount === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

const formatDate = (timestamp?: number, locale?: string) => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleDateString(locale || 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const ProviderUsageDialog = ({
  provider,
  onOpenChange
}: ProviderUsageDialogProps) => {
  const { t, i18n } = useTranslation()

  // Fetch usage info
  const { data: usageInfo, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['providerUsage', provider?.id],
    queryFn: ({ signal }) =>
      provider
        ? api.actions().server.aiModel.getUsageInfo({
            actionParams: { provider },
            abortController: signalToController(signal)
          })
        : null,
    enabled: !!provider
  })

  // Calculate usage percentage
  const calculateUsagePercentage = (used?: number, total?: number) => {
    if (!used || !total) return 0
    return Math.min((used / total) * 100, 100)
  }

  // Get warning level based on usage percentage
  const getWarningLevel = (
    percentage: number
  ): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (percentage > 90) return 'destructive'
    if (percentage > 75) return 'outline'
    return 'secondary'
  }

  // Render loading state
  const renderLoading = () => (
    <div className="space-y-6">
      <div className="space-y-4 p-4 rounded-lg bg-muted/30 animate-pulse">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-4 p-4 rounded-lg bg-card">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  )

  // Render empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="rounded-full bg-muted/30 p-4">
        <ExclamationTriangleIcon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <div className="max-w-[240px]">
        <p className="text-sm font-medium text-muted-foreground mb-1">
          {t('webview.aiProvider.usageInformationUnavailable')}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {t('webview.aiProvider.usageTrackingIssue')}
        </p>
      </div>
    </div>
  )

  // Render usage content
  const renderUsageContent = () => {
    if (!usageInfo) return null

    const usagePercentage = calculateUsagePercentage(
      usageInfo.usedAmount,
      usageInfo.totalAmount
    )

    return (
      <div className="space-y-6">
        {/* Usage Overview Card */}
        <div className="space-y-4 p-6 rounded-xl bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium mb-1">
                {t('webview.aiProvider.usageOverview')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t('webview.aiProvider.currentBillingPeriod')}
              </p>
            </div>
            <Badge
              variant={getWarningLevel(usagePercentage)}
              className="h-6 px-3 tabular-nums"
            >
              {usagePercentage.toFixed(1)}%
            </Badge>
          </div>

          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-end justify-between text-sm">
              <span className="text-muted-foreground">
                {t('webview.aiProvider.usedAmount')}
              </span>
              <span className="font-medium tabular-nums text-base">
                {formatCurrency(usageInfo.usedAmount, usageInfo.currency)}
                <span className="text-xs text-muted-foreground ml-1">
                  / {formatCurrency(usageInfo.totalAmount, usageInfo.currency)}
                </span>
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <div className="flex justify-end text-xs text-muted-foreground">
              {t('webview.aiProvider.remaining')}:{' '}
              {formatCurrency(usageInfo.remainAmount, usageInfo.currency)}
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="rounded-xl bg-card border shadow-sm overflow-hidden">
          {usageInfo.callTokenCount !== undefined && (
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-sky-500/10 p-2">
                  <CircleIcon className="h-3 w-3 text-sky-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {t('webview.aiProvider.totalTokensUsed')}
                  </div>
                </div>
              </div>
              <span className="font-medium tabular-nums text-base">
                {formatNumber(usageInfo.callTokenCount)}
              </span>
            </div>
          )}

          {Boolean(usageInfo.validUntil) && (
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-t">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-2">
                  <CircleIcon className="h-3 w-3 text-emerald-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {t('webview.aiProvider.subscriptionPeriod')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('webview.aiProvider.validUntil')}
                  </div>
                </div>
              </div>
              <span className="font-medium">
                {formatDate(usageInfo.validUntil, i18n.language)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{provider?.name}</span>
            <Badge variant="outline" className="font-normal">
              {t('webview.aiProvider.usageInformation')}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-6">
          {isLoadingUsage && renderLoading()}
          {!isLoadingUsage && !usageInfo && renderEmpty()}
          {!isLoadingUsage && usageInfo && renderUsageContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
