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
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Card, CardContent } from '@webview/components/ui/card'
import { Checkbox } from '@webview/components/ui/checkbox'
import { Switch } from '@webview/components/ui/switch'
import type { McpConnectionStatus } from '@webview/types/chat'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'
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
  const renderField = (
    label: string,
    content: React.ReactNode,
    className?: string
  ) => (
    <div className={cn('space-y-0.5', className)}>
      <div className="text-[0.65rem] uppercase tracking-wider font-medium text-muted-foreground/60">
        {label}
      </div>
      <div className="text-sm">{content}</div>
    </div>
  )

  const renderStatus = () => {
    const { status } = config
    const statusColor = {
      connected: 'text-green-500 bg-green-500/10 border-green-500/20',
      error: 'text-red-500 bg-red-500/10 border-red-500/20',
      disconnected: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
    }[status.state]

    return (
      <div className="space-y-1">
        <div
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full w-fit border',
            statusColor
          )}
        >
          {capitalizeFirstLetter(status.state)}
        </div>
        {status.lastError && (
          <div className="text-[0.65rem] text-destructive/90 bg-destructive/5 p-1.5 rounded-md border border-destructive/10">
            {status.lastError}
          </div>
        )}
      </div>
    )
  }

  const renderLongText = (text: string) => (
    <div className="relative">
      <div className="font-mono text-[0.7rem] break-words p-1.5 bg-muted/40 rounded-md border border-border/40 transition-all duration-200">
        <span className="line-clamp-2 hover:line-clamp-none">{text}</span>
      </div>
    </div>
  )

  const renderActions = () => {
    const actions = [
      <ButtonWithTooltip
        key="edit"
        variant="ghost"
        onClick={() => {
          // eslint-disable-next-line unused-imports/no-unused-vars
          const { status, ...rest } = config
          onEdit(rest)
        }}
        size="sm"
        tooltip="Edit configuration"
        className="h-7 w-7 p-0 hover:bg-primary/5 hover:text-primary transition-colors duration-200"
      >
        <Pencil2Icon className="h-3.5 w-3.5" />
      </ButtonWithTooltip>
    ]

    if (config.isEnabled && config.status.state === 'error') {
      actions.push(
        <ButtonWithTooltip
          key="reconnect"
          variant="ghost"
          onClick={onReconnect}
          size="sm"
          tooltip="Reconnect"
          className="h-7 w-7 p-0 hover:bg-primary/5 hover:text-primary transition-colors duration-200"
          disabled={reconnecting}
        >
          {reconnecting ? (
            <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </ButtonWithTooltip>
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
        <ButtonWithTooltip
          variant="ghost"
          size="sm"
          tooltip="Delete configuration"
          className="h-7 w-7 p-0 hover:bg-destructive/5 text-destructive hover:text-destructive transition-colors duration-200"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </ButtonWithTooltip>
      </AlertAction>
    )

    return actions
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Card className="overflow-hidden border-border/40 bg-gradient-to-b from-card to-card/95 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 dark:hover:border-primary/30 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardContent className="p-3 relative">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {onSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onSelect}
                  className="translate-y-[2px]"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-base text-foreground truncate group-hover:text-primary transition-colors duration-200">
                  {config.name}
                </h3>
                {config.description && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                    {config.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pl-2">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={config.isEnabled}
                  onCheckedChange={onToggleEnabled}
                  disabled={updating}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary/30 h-4 w-7"
                />
                <span className="text-xs text-muted-foreground/90 font-medium min-w-[42px]">
                  {config.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex gap-0.5 items-center">{renderActions()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid gap-2 grid-cols-2">
              {renderField('Status', renderStatus(), 'col-span-1')}
              {renderField(
                'Type',
                <span className="text-foreground/90 font-medium px-2 py-0.5 bg-muted/40 rounded-md inline-block border border-border/40 text-xs">
                  {config.transportConfig.type}
                </span>,
                'col-span-1'
              )}
            </div>

            {config.transportConfig.type === 'stdio' &&
              renderField(
                'Command',
                renderLongText(
                  [
                    config.transportConfig.command,
                    ...(config.transportConfig.args || [])
                  ].join(' ')
                ),
                'col-span-full mt-2'
              )}
            {(config.transportConfig.type === 'websocket' ||
              config.transportConfig.type === 'sse') &&
              renderField(
                'URL',
                <ButtonWithTooltip
                  variant="ghost"
                  size="sm"
                  tooltip={
                    (config.transportConfig as WebSocketClientTransportOptions)
                      .url
                  }
                  className="group/btn p-1.5 h-auto text-[0.7rem] font-mono w-full justify-start hover:bg-primary/5 hover:text-primary transition-colors duration-200 bg-muted/40 border border-border/40"
                  onClick={() =>
                    openLink(
                      (
                        config.transportConfig as WebSocketClientTransportOptions
                      ).url
                    )
                  }
                >
                  <div className="w-full text-left transition-all duration-200">
                    <span className="line-clamp-2  hover:line-clamp-none">
                      {
                        (
                          config.transportConfig as WebSocketClientTransportOptions
                        ).url
                      }
                    </span>
                  </div>
                  <ExternalLinkIcon className="h-2.5 w-2.5 ml-1 flex-shrink-0" />
                </ButtonWithTooltip>,
                'col-span-full mt-2'
              )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
