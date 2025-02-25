import { useEffect, useState } from 'react'
import { ExternalLinkIcon, ReloadIcon, StopIcon } from '@radix-ui/react-icons'
import type { DocSite } from '@shared/entities'
import { useMutation } from '@tanstack/react-query'
import { BaseCard } from '@webview/components/ui/base-card'
import { Button } from '@webview/components/ui/button'
import { Progress } from '@webview/components/ui/progress'
import { StatusBadge } from '@webview/components/ui/status-badge'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import type { ProgressInfo } from '@webview/types/chat'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { useImmer } from 'use-immer'

interface DocSiteCardProps {
  site: DocSite
  onEdit: (site: DocSite) => void
  onRemove: (id: string) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

export const DocSiteCard = ({
  site,
  onEdit,
  onRemove,
  isSelected,
  onSelect
}: DocSiteCardProps) => {
  const { invalidateQueries } = useInvalidateQueries()
  const [progress, setProgress] = useImmer({ crawl: 0, index: 0 })
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)
  const [status, setStatus] = useImmer({
    isCrawled: site.isCrawled,
    isIndexed: site.isIndexed
  })

  // Update status when site changes
  useEffect(() => {
    setStatus({
      isCrawled: site.isCrawled,
      isIndexed: site.isIndexed
    })

    if (site.isCrawled) {
      setProgress(draft => {
        draft.crawl = 100
      })
    }

    if (site.isIndexed) {
      setProgress(draft => {
        draft.index = 100
      })
    }
  }, [site.isCrawled, site.isIndexed])

  // Mutations for crawl and index operations
  const mutations = {
    crawl: useMutation({
      mutationFn: async () => {
        setStatus(draft => {
          draft.isCrawled = false
        })
        setProgress(draft => {
          draft.crawl = 0
        })
        const controller = new AbortController()
        setAbortController(controller)

        try {
          await api.actions().server.doc.crawlDocs(
            {
              actionParams: { id: site.id },
              abortController: controller
            },
            (progress: ProgressInfo) => {
              setProgress(draft => {
                draft.crawl =
                  Math.round(
                    (progress.processedItems / progress.totalItems) * 100
                  ) || 0
              })
            }
          )
          setStatus(draft => {
            draft.isCrawled = true
          })
        } finally {
          setAbortController(null)
          invalidateQueries({
            type: 'all-webview',
            queryKeys: ['docSites']
          })
        }
      }
    }),
    index: useMutation({
      mutationFn: async () => {
        setStatus(draft => {
          draft.isIndexed = false
        })
        setProgress(draft => {
          draft.index = 0
        })
        const controller = new AbortController()
        setAbortController(controller)

        try {
          await api.actions().server.doc.reindexDocs(
            {
              actionParams: { id: site.id, type: 'full' },
              abortController: controller
            },
            (progress: ProgressInfo) => {
              setProgress(draft => {
                draft.index =
                  Math.round(
                    (progress.processedItems / progress.totalItems) * 100
                  ) || 0
              })
            }
          )
          setStatus(draft => {
            draft.isIndexed = true
          })
        } finally {
          setAbortController(null)
          invalidateQueries({
            type: 'all-webview',
            queryKeys: ['docSites']
          })
        }
      }
    })
  }

  // Handle abort operation
  const handleAbort = () => {
    abortController?.abort()
    setAbortController(null)
    invalidateQueries({
      type: 'all-webview',
      queryKeys: ['docSites']
    })
  }

  const renderProgressSection = (
    label: string,
    type: 'crawl' | 'index',
    isCompleted: boolean,
    lastTime?: number
  ) => {
    const isLoading = mutations[type].isPending
    const currentProgress = progress[type]

    const state = isCompleted
      ? ('completed' as const)
      : isLoading
        ? ('processing' as const)
        : ('pending' as const)

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                state={state}
                label={isCompleted ? `Re${label}` : label}
              />
              <div className="text-xs font-medium text-muted-foreground">
                {label}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground/70">
                {currentProgress}%
              </div>
              <div className="shrink-0">
                {isLoading && currentProgress > 0 ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleAbort}
                    className="h-7 px-3 text-xs font-medium hover:bg-destructive/90"
                  >
                    <StopIcon className="h-3 w-3 mr-1.5" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mutations[type].mutate()}
                    disabled={isLoading}
                    className={cn(
                      'h-7 px-3 text-xs font-medium transition-all duration-200',
                      isCompleted
                        ? 'hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30'
                        : 'hover:bg-primary/5 hover:text-primary'
                    )}
                  >
                    {isLoading && (
                      <ReloadIcon className="mr-1.5 h-3 w-3 animate-spin" />
                    )}
                    {isCompleted ? `Re${label}` : label}
                  </Button>
                )}
              </div>
            </div>
          </div>
          {lastTime && (
            <div className="text-[0.65rem] text-muted-foreground/50">
              Last update: {new Date(lastTime).toLocaleString()}
            </div>
          )}
          <Progress
            value={currentProgress}
            className="h-1.5 transition-all duration-300"
          />
        </div>
      </div>
    )
  }

  return (
    <BaseCard
      title={site.name}
      isSelected={isSelected}
      onSelect={onSelect}
      onEdit={() => onEdit(site)}
      onDelete={{
        title: 'Delete Documentation Site',
        description: `Are you sure you want to delete "${site.name}"? This will remove all crawled and indexed data.`,
        onConfirm: () => onRemove(site.id)
      }}
    >
      <div
        className="relative cursor-pointer"
        onClick={() => openLink(site.url)}
      >
        <div className="font-mono text-[0.7rem] break-words p-1.5 bg-muted/40 rounded-md border border-border/40 transition-all duration-200">
          <span className="line-clamp-2 hover:line-clamp-none">
            {site.url} <ExternalLinkIcon className="h-3 w-3 ml-1.5 inline" />
          </span>
        </div>
      </div>

      <div className="grid gap-4 mt-4">
        {renderProgressSection(
          'Crawl',
          'crawl',
          status.isCrawled,
          site.lastCrawledAt
        )}
        {renderProgressSection(
          'Index',
          'index',
          status.isIndexed,
          site.lastIndexedAt
        )}
      </div>
    </BaseCard>
  )
}
