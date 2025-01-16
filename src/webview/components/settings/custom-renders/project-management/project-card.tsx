import { ExternalLinkIcon, Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'
import type { Project } from '@shared/entities'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Button } from '@webview/components/ui/button'
import { Checkbox } from '@webview/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onRemove: (id: string) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

export const ProjectCard = ({
  project,
  onEdit,
  onRemove,
  isSelected,
  onSelect
}: ProjectCardProps) => {
  const renderField = (label: string, content: React.ReactNode) => (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{content}</div>
    </div>
  )

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-card hover:shadow-md transition-shadow space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          {onSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="translate-y-[1px]"
            />
          )}
          <h3 className="font-medium text-foreground text-base">
            {project.name}
          </h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => onEdit(project)}
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted"
          >
            <Pencil2Icon className="h-3.5 w-3.5" />
          </Button>
          <AlertAction
            title="Delete Project"
            description={`Are you sure you want to delete "${project.name}"?`}
            variant="destructive"
            confirmText="Delete"
            onConfirm={() => onRemove(project.id)}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted text-destructive hover:text-destructive"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </Button>
          </AlertAction>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {project.description && renderField('Description', project.description)}
        {renderField(
          'Path',
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="link"
                className="p-0 h-auto text-xs"
                onClick={() => window.open(project.path, '_blank')}
              >
                <div className="truncate max-w-[300px] inline-block align-middle">
                  {project.path}
                </div>
                <ExternalLinkIcon className="h-3 w-3 ml-1 inline" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{project.path}</TooltipContent>
          </Tooltip>
        )}
        {renderField(
          'Last Updated',
          formatDistanceToNow(project.updatedAt, { addSuffix: true })
        )}
      </div>
    </div>
  )
}
