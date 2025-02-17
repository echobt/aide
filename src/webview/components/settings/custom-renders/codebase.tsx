import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@webview/components/ui/button'
import { Card } from '@webview/components/ui/card'
import { Progress } from '@webview/components/ui/progress'
import { api } from '@webview/network/actions-api'
import type { ProgressInfo } from '@webview/types/chat'
import { logger } from '@webview/utils/logger'
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

export const CodebaseIndexing = () => {
  const [progress, setProgress] = useState<number>(0)
  const [isIndexing, setIsIndexing] = useState<boolean>(false)

  const { data: indexStatus } = useQuery({
    queryKey: ['codebaseIndexStatus'],
    queryFn: () =>
      api.actions().server.codebase.getIndexingStatus({
        actionParams: {}
      }),
    refetchInterval: isIndexing ? 1000 : false
  })

  const handleIndexing = async () => {
    setIsIndexing(true)
    setProgress(0)

    try {
      await api.actions().server.codebase.reindexCodebase(
        {
          actionParams: {
            type: 'full'
          }
        },
        (progress: ProgressInfo) => {
          logger.dev.verbose('progress', progress)
          setProgress(
            Math.round((progress.processedItems / progress.totalItems) * 100)
          )
        }
      )
    } catch (error) {
      logger.error('Indexing failed:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  const getStatusIcon = () => {
    if (isIndexing) {
      return <RefreshCw className="h-5 w-5 animate-spin text-foreground" />
    }
    if (!indexStatus?.lastIndexTime) {
      return <Clock className="h-5 w-5 text-foreground" />
    }
    return indexStatus.isIndexCompleted ? (
      <CheckCircle2 className="h-5 w-5 text-primary" />
    ) : (
      <AlertCircle className="h-5 w-5 text-primary" />
    )
  }

  const getStatusText = () => {
    if (isIndexing) {
      return 'Indexing in progress...'
    }
    if (!indexStatus?.lastIndexTime) {
      return 'Never indexed'
    }
    const lastIndexDate = new Date(indexStatus.lastIndexTime).toLocaleString()
    return indexStatus.isIndexCompleted
      ? `Last indexed: ${lastIndexDate}`
      : `Last indexing failed: ${lastIndexDate}`
  }

  const getButtonText = () => {
    if (isIndexing) {
      return (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Indexing
        </>
      )
    }
    return indexStatus?.lastIndexTime && indexStatus.isIndexCompleted
      ? 'Reindex'
      : 'Start Indexing'
  }

  return (
    <Card className="p-4">
      <div className=" flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <span className="text-sm text-muted-foreground">
            {getStatusText()}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={handleIndexing}
          disabled={isIndexing}
          className="min-w-[120px]"
        >
          {getButtonText()}
        </Button>
      </div>
      {isIndexing && (
        <div className="space-y-2 mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-right text-sm text-muted-foreground">
            {progress}% completed
          </p>
        </div>
      )}
    </Card>
  )
}
