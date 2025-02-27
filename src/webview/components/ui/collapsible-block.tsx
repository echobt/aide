import React, { ReactNode, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  Cross2Icon,
  DotFilledIcon
} from '@radix-ui/react-icons'
import { Button } from '@webview/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export type CollapsibleBlockStatus =
  | 'idle'
  | 'loading'
  | 'waiting'
  | 'success'
  | 'error'

export interface CollapsibleBlockProps {
  children: ReactNode
  title: ReactNode
  actionSlot?: ReactNode
  statusSlot?: ReactNode
  defaultExpanded?: boolean
  status?: CollapsibleBlockStatus
  className?: string
  onClickTitle?: () => void
}

export const CollapsibleBlock: React.FC<CollapsibleBlockProps> = ({
  children,
  title,
  actionSlot: actions,
  statusSlot,
  defaultExpanded = false,
  status = 'idle',
  className = '',
  onClickTitle
}) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={`relative overflow-hidden rounded-md border ${className}`}>
      <div className="h-8 flex items-center justify-between px-2 text-xs">
        <div
          className="flex h-full items-center flex-1 gap-1 cursor-pointer"
          onClick={() =>
            onClickTitle ? onClickTitle() : setIsExpanded(!isExpanded)
          }
        >
          {typeof title === 'string' ? <CodeIcon className="size-3" /> : null}
          <span className="font-medium">{title}</span>

          {statusSlot ? (
            <div
              className="flex h-full items-center shrink-0 flex-1 gap-1"
              onClick={e => {
                e.stopPropagation()
              }}
            >
              {statusSlot}
            </div>
          ) : null}

          {status === 'loading' && (
            <Button
              className="transition-colors"
              size="iconXss"
              variant="ghost"
              aria-label={t('webview.collapsibleBlock.loading')}
              disabled
            >
              <div className="size-3 border-2 rounded-full animate-spin border-t-primary" />
            </Button>
          )}

          {status === 'waiting' && (
            <Button
              className="transition-colors"
              size="iconXss"
              variant="ghost"
              aria-label={t('webview.collapsibleBlock.waiting')}
              disabled
            >
              <DotFilledIcon className="size-3 text-primary" />
            </Button>
          )}

          {status === 'success' && (
            <Button
              className="transition-colors"
              size="iconXss"
              variant="ghost"
              aria-label={t('webview.collapsibleBlock.success')}
              disabled
            >
              <CheckIcon className="size-3 text-primary" />
            </Button>
          )}

          {status === 'error' && (
            <Button
              className="transition-colors"
              size="iconXss"
              variant="ghost"
              aria-label={t('webview.collapsibleBlock.error')}
              disabled
            >
              <Cross2Icon className="size-3 text-destructive" />
            </Button>
          )}
        </div>

        <div className="flex items-center  gap-1">
          {actions}
          <Button
            className="transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            size="iconXss"
            variant="ghost"
            aria-label={
              isExpanded
                ? t('webview.collapsibleBlock.collapseCode')
                : t('webview.collapsibleBlock.expandCode')
            }
          >
            {isExpanded ? (
              <ChevronUpIcon className="size-3" />
            ) : (
              <ChevronDownIcon className="size-3" />
            )}
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        <motion.div
          initial="collapsed"
          animate={isExpanded ? 'expanded' : 'collapsed'}
          exit="collapsed"
          variants={{
            expanded: { opacity: 1, height: 'auto' },
            collapsed: { opacity: 0, height: 0 }
          }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
          style={{ willChange: 'auto' }}
        >
          <div className="text-xs p-2">{children}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
