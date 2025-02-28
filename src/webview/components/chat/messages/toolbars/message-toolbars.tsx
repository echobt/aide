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
import { ButtonWithPromise } from '@webview/components/button-with-promise'
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
import { SnowflakeIcon, SquareStackIcon, SunSnowIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  onCopyPrompt?: (conversation: Conversation) => void
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
  onCopyPrompt,
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
  const { t } = useTranslation()

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
        toast.warning(t('webview.messages.waitForCompletion'))
        return
      }
      fn()
    }

    return (
      <>
        {/* create new session */}
        {onCreateNewSession && (
          <ButtonWithTooltip
            tooltip={t('webview.messages.createNewSession')}
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
                tooltip={
                  isFreeze
                    ? t('webview.messages.unfreeze')
                    : t('webview.messages.freeze')
                }
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
                    {t('webview.messages.unfreezeCurrentMessage')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onUnfreeze?.(getConversation(), 'currentAndPrevious')
                    )}
                  >
                    {t('webview.messages.unfreezeCurrentAndPrevious')}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onFreeze?.(getConversation(), 'current')
                    )}
                  >
                    {t('webview.messages.freezeCurrentMessage')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={withToast(() =>
                      onFreeze?.(getConversation(), 'currentAndPrevious')
                    )}
                  >
                    {t('webview.messages.freezeCurrentAndPrevious')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* copy */}
        {onCopy && (
          <ButtonWithPromise
            tooltip={t('webview.common.copy')}
            {...buttonProps}
            promiseFn={async () => await onCopy(getConversation())}
          >
            <CopyIcon className={iconClassName} />
          </ButtonWithPromise>
        )}

        {/* copy prompt */}
        {onCopyPrompt && (
          <ButtonWithPromise
            tooltip={t('webview.messages.copyAsPrompt')}
            {...buttonProps}
            promiseFn={async () => await onCopyPrompt(getConversation())}
          >
            <SquareStackIcon className={iconClassName} />
          </ButtonWithPromise>
        )}

        {/* edit */}
        {onEdit && (
          <ButtonWithTooltip
            tooltip={t('webview.common.edit')}
            {...buttonProps}
            onClick={withToast(() => onEdit(getConversation()))}
          >
            <Pencil2Icon className={disabledOnSendingIconClassName} />
          </ButtonWithTooltip>
        )}

        {/* delete */}
        {onDelete && (
          <AlertAction
            title={t('webview.messages.deleteItems')}
            description={t('webview.messages.deleteConfirmation')}
            variant="destructive"
            confirmText={t('webview.common.delete')}
            onConfirm={withToast(() => onDelete(getConversation()))}
          >
            <ButtonWithTooltip
              tooltip={t('webview.common.delete')}
              {...buttonProps}
            >
              <TrashIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        )}

        {/* restore checkpoint */}
        {onRestoreCheckpoint && (
          <AlertAction
            title={t('webview.messages.restoreCheckpoint')}
            description={t('webview.messages.restoreCheckpointConfirmation')}
            variant="destructive"
            confirmText={t('webview.messages.restore')}
            onConfirm={withToast(() => onRestoreCheckpoint(getConversation()))}
          >
            <ButtonWithTooltip
              tooltip={t('webview.messages.restoreCheckpoint')}
              {...buttonProps}
            >
              <ResetIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        )}

        {/* regenerate */}
        {onRegenerate && onRestoreCheckpoint ? (
          <AlertAction
            title={t('webview.messages.regenerate')}
            description={t(
              'webview.messages.regenerateWithCheckpointConfirmation'
            )}
            variant="destructive"
            confirmText={t('webview.messages.regenerate')}
            onConfirm={withToast(() => {
              onRestoreCheckpoint(getConversation())
              onRegenerate(getConversation())
            })}
            onCancel={withToast(() => onRegenerate(getConversation()))}
          >
            <ButtonWithTooltip
              tooltip={t('webview.messages.regenerate')}
              {...buttonProps}
            >
              <ReloadIcon className={disabledOnSendingIconClassName} />
            </ButtonWithTooltip>
          </AlertAction>
        ) : onRegenerate ? (
          <ButtonWithTooltip
            tooltip={t('webview.messages.regenerate')}
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
