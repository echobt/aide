/* eslint-disable unused-imports/no-unused-vars */
import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import { Cross2Icon, DotFilledIcon, ReloadIcon } from '@radix-ui/react-icons'
import type { SFC } from '@shared/types/common'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { FileIcon } from '@webview/components/file-icon'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionActionContext } from '@webview/contexts/conversation-action-context/session-action-context'
import { useFileInfoForMessage } from '@webview/hooks/api/use-file-info-for-message'
import { api } from '@webview/network/actions-api'
import { cn } from '@webview/utils/common'
import { getFileNameFromPath } from '@webview/utils/path'
import { CheckIcon, PlayIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CustomRenderFloatingActionItemProps } from '../../_base/client/agent-client-plugin-types'
import type { EditFileAction } from '../types'

export const EditFileAgentFloatingActionItem: SFC<
  CustomRenderFloatingActionItemProps<EditFileAction>
> = props => {
  const { t } = useTranslation()
  const { conversationAction, conversation } = props
  const { context } = useChatContext()
  const sessionId = context.id
  const conversationId = conversation.id
  const actionId = conversationAction.id

  const {
    startActionMutation,
    restartActionMutation,
    acceptActionMutation,
    rejectActionMutation
  } = useSessionActionContext()
  const { data: fileInfo } = useFileInfoForMessage({
    schemeUri: conversationAction.agent?.input.targetFilePath
  })

  const { codeEditTask } = conversationAction.state
  const schemeUri =
    fileInfo?.schemeUri || conversationAction.agent?.input.targetFilePath

  const openFileInEditor = async () => {
    if (!schemeUri) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        schemeUri
      }
    })
  }

  const renderActionButton = () => {
    if (codeEditTask?.state === CodeEditTaskState.Initial || !codeEditTask) {
      return (
        <ButtonWithTooltip
          size="iconXss"
          variant="ghost"
          tooltip={t('shared.plugins.agents.editFile.actions.apply')}
          onClick={() =>
            startActionMutation.mutate({
              sessionId,
              conversationId,
              actionId
            })
          }
        >
          <PlayIcon className="size-3" />
        </ButtonWithTooltip>
      )
    }

    if (codeEditTask?.state === CodeEditTaskState.WaitingForReview) {
      return (
        <>
          {/* reject */}
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip={t('shared.plugins.agents.editFile.actions.reject')}
            onClick={() =>
              rejectActionMutation.mutate({
                sessionId,
                conversationId,
                actionId
              })
            }
          >
            <Cross2Icon className="size-3" />
          </ButtonWithTooltip>

          {/* accept */}
          <ButtonWithTooltip
            size="iconXss"
            variant="default"
            tooltip={t('shared.plugins.agents.editFile.actions.accept')}
            onClick={() =>
              acceptActionMutation.mutate({
                sessionId,
                conversationId,
                actionId
              })
            }
          >
            <CheckIcon className="size-3" />
          </ButtonWithTooltip>
        </>
      )
    }

    return (
      <ButtonWithTooltip
        size="iconXss"
        variant="ghost"
        tooltip={t('shared.plugins.agents.editFile.actions.reapply')}
        onClick={() =>
          restartActionMutation.mutate({
            sessionId,
            conversationId,
            actionId
          })
        }
      >
        <ReloadIcon className="size-3" />
      </ButtonWithTooltip>
    )
  }

  if (!schemeUri) return null

  return (
    <div
      className={cn(
        'w-full py-0.5 cursor-pointer rounded-md text-sm flex items-center justify-between gap-2 hover:bg-border select-none'
      )}
      onClick={openFileInEditor}
    >
      <div className="flex shrink-0 items-center gap-2">
        {/* title */}
        <FileIcon className="size-4" filePath={schemeUri} />
        <span>{getFileNameFromPath(schemeUri)}</span>

        {/* status */}
        {codeEditTask?.state === CodeEditTaskState.Generating && (
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip={t('shared.plugins.agents.editFile.status.generating')}
          >
            <div className="size-3 border-2 rounded-full animate-spin border-t-primary" />
          </ButtonWithTooltip>
        )}

        {codeEditTask?.state === CodeEditTaskState.WaitingForReview && (
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip={t('shared.plugins.agents.editFile.status.reviewing')}
          >
            <DotFilledIcon className="size-3 text-primary" />
          </ButtonWithTooltip>
        )}

        {codeEditTask?.state === CodeEditTaskState.Accepted && (
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip={t('shared.plugins.agents.editFile.status.accepted')}
          >
            <CheckIcon className="size-3 text-primary" />
          </ButtonWithTooltip>
        )}

        {codeEditTask?.state === CodeEditTaskState.Rejected && (
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip={t('shared.plugins.agents.editFile.status.rejected')}
          >
            <Cross2Icon className="size-3 text-destructive" />
          </ButtonWithTooltip>
        )}
      </div>

      {/* actions */}
      <div
        className="flex shrink-0 items-center gap-2"
        onClick={e => e.stopPropagation()}
      >
        {renderActionButton()}
      </div>
    </div>
  )
}
