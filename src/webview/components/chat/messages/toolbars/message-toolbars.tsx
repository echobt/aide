import type { FC } from 'react'
import {
  CopyIcon,
  Pencil2Icon,
  PlusIcon,
  ReloadIcon,
  ResetIcon,
  TrashIcon
} from '@radix-ui/react-icons'
import type { Conversation } from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { AlertAction } from '@webview/components/ui/alert-action'
import type { ButtonProps } from '@webview/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@webview/components/ui/dropdown-menu'
import { useConversationContext } from '@webview/contexts/conversation-context'
import { cn } from '@webview/utils/common'
import { SnowflakeIcon, SunSnowIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  BaseToolbar,
  type BaseToolbarProps,
  type BuildToolbarChildrenFn
} from './base-toolbar'

export type FreezeType = 'current' | 'currentAndPrevious'

export interface MessageToolbarEvents {
  isSending?: boolean
  onCopy?: (conversation: Conversation) => void
  onEdit?: (conversation: Conversation) => void
  onDelete?: (conversation: Conversation) => void
  onRegenerate?: (conversation: Conversation) => void
  onFreeze?: (conversation: Conversation, freezeType: FreezeType) => void
  onUnfreeze?: (conversation: Conversation, unfreezeType: FreezeType) => void
  onCreateNewSession?: (conversation: Conversation) => void
  onRestoreCheckpoint?: (conversation: Conversation) => void
}

export interface MessageToolbarProps
  extends Omit<BaseToolbarProps, 'buildChildren'>,
    MessageToolbarEvents {}

export const MessageToolbar: FC<MessageToolbarProps> = ({
  isSending,
  onCopy,
  onEdit,
  onDelete,
  onRegenerate,
  onFreeze,
  onUnfreeze,
  onCreateNewSession,
  onRestoreCheckpoint,
  ...props
}) => {
  const { conversation, getConversation } = useConversationContext()

  const { isFreeze } = conversation.state

  const buildChildren: BuildToolbarChildrenFn = ({ isFloating }) => {
    const buttonProps: Partial<ButtonProps> = {
      variant: 'ghost',
      size: isFloating ? 'iconSm' : 'iconXs'
    }

    const iconClassName = cn(isFloating ? 'size-4' : 'size-3')
    const disabledOnSendingIconClassName = cn(
      iconClassName,
      isSending && 'opacity-50'
    )

    const withToast = (fn: () => void) => () => {
      if (isSending) {
        toast.warning('Please stop or wait for the current message to finish.')
        return
      }
      fn()
    }

    return (
      <>
        {/* create new session */}
        {onCreateNewSession && (
          <ButtonWithTooltip
            tooltip="Create New Session From Here"
            {...buttonProps}
            onClick={withToast(() => onCreateNewSession(getConversation()))}
          >
            <PlusIcon className={disabledOnSendingIconClassName} />
          </ButtonWithTooltip>
        )}

        {/* freeze/unfreeze */}
        {(onFreeze || onUnfreeze) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ButtonWithTooltip
                tooltip={isFreeze ? 'Unfreeze' : 'Freeze'}
                {...buttonProps}
              >
                {isFreeze ? (
                  <SunSnowIcon
                    className={cn(
                      disabledOnSendingIconClassName,
                      'text-primary'
                    )}
                  />
                ) : (
                  <SnowflakeIcon className={disabledOnSendingIconClassName} />
                )}
              </ButtonWithTooltip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isFreeze ? (
                <>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onUnfreeze?.(getConversation(), 'current')
                    )}
                  >
                    Unfreeze Current Message
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onUnfreeze?.(getConversation(), 'currentAndPrevious')
                    )}
                  >
                    Unfreeze Current & Previous Messages
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onFreeze?.(getConversation(), 'current')
                    )}
                  >
                    Freeze Current Message
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onFreeze?.(getConversation(), 'currentAndPrevious')
                    )}
                  >
                    Freeze Current & Previous Messages
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* copy */}
        {onCopy && (
          <ButtonWithTooltip
            tooltip="Copy"
            {...buttonProps}
            onClick={() => onCopy(getConversation())}
          >
            <CopyIcon className={iconClassName} />
          </ButtonWithTooltip>
        )}

        {/* edit */}
        {onEdit && (
          <ButtonWithTooltip
            tooltip="Edit"
            {...buttonProps}
            onClick={withToast(() => onEdit(getConversation()))}
          >
            <Pencil2Icon className={disabledOnSendingIconClassName} />
          </ButtonWithTooltip>
        )}

        {/* delete */}
        {onDelete && (
          <AlertAction
            title="Delete Items"
            description="Are you sure ?"
            variant="destructive"
            confirmText="Delete"
            onConfirm={withToast(() => onDelete(getConversation()))}
          >
            <ButtonWithTooltip tooltip="Delete" {...buttonProps}>
              <TrashIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        )}

        {/* restore checkpoint */}
        {onRestoreCheckpoint && (
          <AlertAction
            title="Restore Checkpoint"
            description="Do you want to restore checkpoint?"
            variant="destructive"
            confirmText="Restore"
            onConfirm={withToast(() => onRestoreCheckpoint(getConversation()))}
          >
            <ButtonWithTooltip tooltip="Restore Checkpoint" {...buttonProps}>
              <ResetIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        )}

        {/* regenerate */}
        {onRegenerate && onRestoreCheckpoint ? (
          <AlertAction
            title="Regenerate"
            description="Do you want to restore checkpoint before regenerate?"
            variant="destructive"
            confirmText="Regenerate"
            onConfirm={withToast(() => {
              onRestoreCheckpoint(getConversation())
              onRegenerate(getConversation())
            })}
            onCancel={withToast(() => onRegenerate(getConversation()))}
          >
            <ButtonWithTooltip tooltip="Regenerate" {...buttonProps}>
              <ReloadIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        ) : onRegenerate ? (
          <ButtonWithTooltip
            tooltip="Regenerate"
            {...buttonProps}
            onClick={withToast(() => onRegenerate(getConversation()))}
          >
            <ReloadIcon className={disabledOnSendingIconClassName} />
          </ButtonWithTooltip>
        ) : null}
      </>
    )
  }

  return <BaseToolbar {...props} buildChildren={buildChildren} />
}
