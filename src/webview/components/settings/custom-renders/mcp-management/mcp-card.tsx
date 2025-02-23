import { ExternalLinkIcon, UpdateIcon } from '@radix-ui/react-icons'
import type {
  McpConfig,
  WebSocketClientTransportOptions
} from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { BaseCard } from '@webview/components/ui/base-card'
import { StatusBadge } from '@webview/components/ui/status-badge'
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
    return <StatusBadge state={status.state} error={status.lastError} />
  }

  const renderLongText = (text: string) => (
    <div className="relative">
      <div className="font-mono text-[0.7rem] break-words p-1.5 bg-muted/40 rounded-md border border-border/40 transition-all duration-200">
        <span className="line-clamp-2 hover:line-clamp-none">{text}</span>
      </div>
    </div>
  )

  const extraActions = []

  if (config.isEnabled && config.status.state === 'error') {
    extraActions.push({
      icon: reconnecting ? (
        <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      ),
      label: 'Reconnect',
      onClick: onReconnect
    })
  }

  const switchControl = (
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
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <BaseCard
        title={config.name}
        subtitle={config.description}
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
                    (config.transportConfig as WebSocketClientTransportOptions)
                      .url
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
      </BaseCard>
    </motion.div>
  )
}
