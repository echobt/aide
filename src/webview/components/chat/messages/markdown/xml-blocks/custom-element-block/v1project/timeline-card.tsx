import { Fragment } from 'react/jsx-runtime'
import { FileIcon } from '@webview/components/file-icon'
import { cn } from '@webview/utils/common'
import { ExternalLinkIcon } from 'lucide-react'

export interface TimelineItem {
  title: string
  onClick?: () => void
}

export interface TimelineCardProps {
  projectName: string
  projectVersion: number // version index, start from 0
  projectPresetFrameworkName: string
  items: TimelineItem[]
  onOpenProject?: () => void
}

export const TimelineCard = ({
  projectName,
  projectVersion = 0,
  projectPresetFrameworkName,
  items,
  onOpenProject
}: TimelineCardProps) => {
  const iconClassName = 'size-4'

  const frameworkNameIconMap = {
    react: <FileIcon filePath="a.tsx" className={iconClassName} />,
    vue: <FileIcon filePath="a.vue" className={iconClassName} />,
    svelte: <FileIcon filePath="a.svelte" className={iconClassName} />,
    solid: <FileIcon filePath="a.tsx" className={iconClassName} />,
    html: <FileIcon filePath="a.html" className={iconClassName} />
  }

  const frameworkNameIcon = frameworkNameIconMap[
    projectPresetFrameworkName?.toLowerCase() as keyof typeof frameworkNameIconMap
  ] || <FileIcon filePath="a.ts" className={iconClassName} />

  return (
    <div
      className="bg-background flex w-full max-w-full cursor-pointer select-none flex-col items-start justify-between rounded-[10px] border transition-all duration-200 ease-in-out md:w-[400px] hover:ring-alpha-400 hover:border-primary"
      onClick={onOpenProject}
    >
      <div className="bg-muted flex w-full items-center justify-between gap-2 rounded-t-[10px] p-2">
        {frameworkNameIcon}
        <div className="my-0 flex w-full min-w-0 max-w-full items-center gap-2 text-sm">
          <div className="min-w-0 shrink truncate">{projectName}</div>
          <div className="bg-primary text-primary-foreground flex h-5 items-center gap-1 rounded-md px-1 text-[12px]">
            V{projectVersion + 1}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <span className="leading-none">Open</span>
          <ExternalLinkIcon className="size-4 ml-1" />
        </div>
      </div>
      <div className="w-full border-t" />
      <div className="my-0 flex w-full max-w-full flex-col p-2 text-left">
        {items.map((item, index) => (
          <Fragment key={index}>
            {/* connect line */}
            {index !== 0 && (
              <div className="flex h-4 w-4 items-center justify-center">
                <hr className="h-full w-[1px] bg-foreground" />
              </div>
            )}
            <div
              className="flex h-4 min-w-0 cursor-pointer items-center gap-2 text-xs"
              onClick={e => {
                e.stopPropagation()
                item.onClick?.()
              }}
            >
              {/* dot */}
              <div className="flex size-4 shrink-0 items-center justify-center">
                <span className="relative flex size-[10px] items-center justify-center rounded-full bg-foreground">
                  <span className="bg-background absolute left-1/2 top-1/2 size-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                  <span className="absolute left-1/2 top-1/2 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
                </span>
              </div>
              {/* title */}
              <div
                className={cn(
                  'truncate text-left',
                  item.onClick && 'cursor-pointer hover:underline'
                )}
              >
                {item.title}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
