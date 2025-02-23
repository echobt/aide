import {
  ExternalLinkIcon,
  Pencil2Icon,
  TrashIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import type {
  McpConfig,
  WebSocketClientTransportOptions
} from '@shared/entities'
import { capitalizeFirstLetter } from '@shared/utils/common'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Button } from '@webview/components/ui/button'
import { Checkbox } from '@webview/components/ui/checkbox'
import { Switch } from '@webview/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import type { McpConnectionStatus } from '@webview/types/chat'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { RotateCcw } from 'lucide-react'

interface McpCardProps {
  config: McpConfig & {
    status: McpConnectionStatus
  }
  onEdit: (config: McpConfig) => void
  onRemove: (id: string) => void
  onReconnect: () => void
  onToggleEnabled: (enabled: boolean) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  reconnecting?: boolean
  updating?: boolean
}

export const McpCard = ({
  config,
  onEdit,
  onRemove,
  onReconnect,
  onToggleEnabled,
  isSelected,
  onSelect,
  reconnecting,
  updating
}: McpCardProps) => {
  const renderField = (label: string, content: React.ReactNode) => (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{content}</div>
    </div>
  )

  const renderStatus = () => {
    const { status } = config
    const statusColor = {
      connected: 'text-green-500',
      error: 'text-red-500',
      disconnected: 'text-yellow-500'
    }[status.state]

    return (
      <div className="space-y-1">
        <div className={cn('text-sm font-medium', statusColor)}>
          {capitalizeFirstLetter(status.state)}
        </div>
        {status.lastError && (
          <div className="text-xs text-destructive">{status.lastError}</div>
        )}
      </div>
    )
  }

  const renderActions = () => {
    const actions = [
      <Button
        key="edit"
        variant="ghost"
        onClick={() => {
          // eslint-disable-next-line unused-imports/no-unused-vars
          const { status, ...rest } = config
          onEdit(rest)
        }}
        size="sm"
        className="h-7 w-7 p-0 hover:bg-muted"
      >
        <Pencil2Icon className="h-3.5 w-3.5" />
      </Button>
    ]

    // Only show reconnect button when config is enabled and status is error
    if (config.isEnabled && config.status.state === 'error') {
      actions.push(
        <Button
          key="reconnect"
          variant="ghost"
          onClick={onReconnect}
          size="sm"
          className="h-7 w-7 p-0 hover:bg-muted"
          disabled={reconnecting}
        >
          {reconnecting ? (
            <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </Button>
      )
    }

    actions.push(
      <AlertAction
        key="delete"
        title="Delete MCP Configuration"
        description={`Are you sure you want to delete "${config.name}"?`}
        variant="destructive"
        confirmText="Delete"
        onConfirm={() => onRemove(config.id)}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-muted text-destructive hover:text-destructive"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </Button>
      </AlertAction>
    )

    return actions
  }

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
            {config.name}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.isEnabled}
              onCheckedChange={onToggleEnabled}
              disabled={updating}
            />
            <span className="text-sm text-muted-foreground">
              {config.isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex gap-2">{renderActions()}</div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {config.description && renderField('Description', config.description)}
        {renderField('Type', config.transportConfig.type)}
        {config.transportConfig.type === 'stdio' &&
          renderField(
            'Command',
            [
              config.transportConfig.command,
              ...(config.transportConfig.args || [])
            ].join(' ')
          )}
        {(config.transportConfig.type === 'websocket' ||
          config.transportConfig.type === 'sse') &&
          renderField(
            'URL',
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs"
                  onClick={() =>
                    openLink(
                      (
                        config.transportConfig as WebSocketClientTransportOptions
                      ).url
                    )
                  }
                >
                  <div className="truncate max-w-[300px] inline-block align-middle">
                    {config.transportConfig.url}
                  </div>
                  <ExternalLinkIcon className="h-3 w-3 ml-1 inline" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{config.transportConfig.url}</TooltipContent>
            </Tooltip>
          )}
        {renderField('Status', renderStatus())}
      </div>
    </div>
  )
}
