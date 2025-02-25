import {
  CircleIcon,
  CodeIcon,
  ExternalLinkIcon,
  GlobeIcon,
  ReloadIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import type {
  McpConfig,
  WebSocketClientTransportOptions
} from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { BaseCard } from '@webview/components/ui/base-card'
import { StatusBadge } from '@webview/components/ui/status-badge'
import { Switch } from '@webview/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import type { McpConnectionStatus } from '@webview/types/chat'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'

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
  const getTransportIcon = () => {
    switch (config.transportConfig.type) {
      case 'stdio':
        return <CodeIcon className="h-4 w-4" />
      case 'websocket':
        return <GlobeIcon className="h-4 w-4" />
      case 'sse':
        return <CodeIcon className="h-4 w-4" />
      default:
        return <CircleIcon className="h-4 w-4" />
    }
  }

  const renderField = (
    icon: React.ReactNode,
    content: React.ReactNode,
    className?: string
  ) => (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="text-muted-foreground/50 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  )

  const extraActions = [
    {
      icon: reconnecting ? (
        <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ReloadIcon className="h-3.5 w-3.5" />
      ),
      label: 'Reconnect',
      onClick: onReconnect,
      disabled: !config.isEnabled || config.status.state !== 'error'
    }
  ]

  const switchControl = (
    <div className="flex items-center gap-2">
      <Switch
        checked={config.isEnabled}
        onCheckedChange={onToggleEnabled}
        disabled={updating}
      />
      <span className="text-xs font-medium text-muted-foreground/90">
        {config.isEnabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  )

  const renderTransportContent = () => {
    if (config.transportConfig.type === 'stdio') {
      const command = [
        config.transportConfig.command,
        ...(config.transportConfig.args || [])
      ].join(' ')

      // Extract the main command and first few arguments
      const parts = command.split(' ')
      const mainCommand = parts[0]
      const shortPreview =
        parts.length > 1
          ? `${mainCommand} ${parts.slice(1, 3).join(' ')}${parts.length > 3 ? '...' : ''}`
          : mainCommand

      return (
        <Tooltip>
          <TooltipTrigger className="block text-sm text-left w-full">
            <div className="flex items-center gap-2 group/cmd">
              <div className="font-mono truncate text-muted-foreground/90 group-hover/cmd:text-muted-foreground/100 transition-colors">
                {shortPreview}
              </div>
              <div className="text-[10px] text-muted-foreground/50 shrink-0">
                {parts.length} args
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xl">
            <div className="font-mono whitespace-pre-wrap break-all text-xs">
              {command}
            </div>
          </TooltipContent>
        </Tooltip>
      )
    }

    if (
      config.transportConfig.type === 'websocket' ||
      config.transportConfig.type === 'sse'
    ) {
      const { url } = config.transportConfig as WebSocketClientTransportOptions

      // Parse URL to show meaningful parts
      try {
        const urlObj = new URL(url)
        const shortPreview = `${urlObj.protocol}//${urlObj.host}${
          urlObj.pathname.length > 20
            ? `${urlObj.pathname.slice(0, 20)}...`
            : urlObj.pathname
        }`

        return (
          <ButtonWithTooltip
            variant="link"
            tooltip={url}
            className="p-0 h-auto text-sm font-medium hover:no-underline justify-start w-full"
            onClick={() => openLink(url)}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="truncate text-left">{shortPreview}</div>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </div>
          </ButtonWithTooltip>
        )
      } catch {
        // Fallback if URL parsing fails
        return (
          <ButtonWithTooltip
            tooltip={url}
            variant="link"
            className="p-0 h-auto text-sm font-medium hover:no-underline justify-start w-full"
            onClick={() => openLink(url)}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="truncate text-left">
                {url.length > 50 ? `${url.slice(0, 50)}...` : url}
              </div>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </div>
          </ButtonWithTooltip>
        )
      }
    }

    return null
  }

  return (
    <BaseCard
      title={config.name}
      subtitle={config.description}
      badge={{
        text: config.transportConfig.type,
        variant: 'muted'
      }}
      isSelected={isSelected}
      onSelect={onSelect}
      onEdit={() => {
        // eslint-disable-next-line unused-imports/no-unused-vars
        const { status, ...rest } = config
        onEdit(rest)
      }}
      onDelete={{
        title: 'Delete MCP Endpoint',
        description: `Are you sure you want to delete "${config.name}"?`,
        onConfirm: () => onRemove(config.id)
      }}
      extraActions={extraActions}
      actionLeftSlot={switchControl}
    >
      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <StatusBadge state={config.status.state} />
          {config.status.lastError && (
            <Tooltip>
              <TooltipTrigger className="text-xs text-destructive/80 truncate">
                {config.status.lastError}
              </TooltipTrigger>
              <TooltipContent>{config.status.lastError}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {renderField(getTransportIcon(), renderTransportContent())}
      </div>
    </BaseCard>
  )
}
