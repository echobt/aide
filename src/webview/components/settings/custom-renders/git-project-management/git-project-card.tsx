import {
  CalendarIcon,
  ExternalLinkIcon,
  GitHubLogoIcon,
  ReloadIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import type { GitProject } from '@shared/entities'
import { BaseCard } from '@webview/components/ui/base-card'
import { Button } from '@webview/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'

interface GitProjectCardProps {
  project: GitProject
  onEdit: (project: GitProject) => void
  onRemove: (id: string) => void
  onRefresh: (id: string) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  refreshing?: boolean
}

export const GitProjectCard = ({
  project,
  onEdit,
  onRemove,
  onRefresh,
  isSelected,
  onSelect,
  refreshing
}: GitProjectCardProps) => {
  const { t } = useTranslation()

  const renderField = (
    icon: React.ReactNode,
    content: React.ReactNode,
    className?: string
  ) => (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <div className="text-muted-foreground/50">{icon}</div>
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  )

  const lastUpdated = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true
  })

  const extraActions = [
    {
      icon: refreshing ? (
        <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ReloadIcon className="h-3.5 w-3.5" />
      ),
      label: t('webview.gitProject.refreshRepository'),
      onClick: () => onRefresh(project.id)
    }
  ]

  return (
    <BaseCard
      title={project.name}
      subtitle={project.description}
      badge={{
        text: project.type,
        variant: 'muted'
      }}
      isSelected={isSelected}
      onSelect={onSelect}
      onEdit={() => onEdit(project)}
      onDelete={{
        title: t('webview.gitProject.deleteProject'),
        description: t('webview.gitProject.deleteProjectConfirmation', {
          name: project.name
        }),
        onConfirm: () => onRemove(project.id)
      }}
      extraActions={extraActions}
    >
      <div className="space-y-2.5 mt-2">
        {renderField(
          <GitHubLogoIcon className="h-4 w-4" />,
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="link"
                className="p-0 h-auto text-sm font-medium hover:no-underline"
                onClick={() => openLink(project.repoUrl)}
              >
                <div className="truncate max-w-[300px] inline-block align-middle text-left">
                  {project.repoUrl}
                </div>
                <ExternalLinkIcon className="h-3.5 w-3.5 ml-1.5 inline-block opacity-70" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{project.repoUrl}</TooltipContent>
          </Tooltip>
        )}
        {renderField(
          <CalendarIcon className="h-4 w-4" />,
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground/70">
              {lastUpdated}
            </TooltipTrigger>
            <TooltipContent>
              {new Date(project.updatedAt).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </BaseCard>
  )
}
