/* eslint-disable unused-imports/no-unused-vars */
import { InlineDiffTaskState } from '@extension/registers/inline-diff-register/types'
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

import type { CustomRenderFloatingActionItemProps } from '../../_base/client/agent-client-plugin-types'
import type { EditFileAction } from '../types'

export const EditFileAgentFloatingActionItem: SFC<
  CustomRenderFloatingActionItemProps<EditFileAction>
> = props => {
  const { conversationAction, conversation } = props

  const { context } = useChatContext()
  const {
    startActionMutation,
    restartActionMutation,
    acceptActionMutation,
    rejectActionMutation
  } = useSessionActionContext()
  const { data: fileInfo } = useFileInfoForMessage({
    relativePath: conversationAction.agent?.input.targetFilePath
  })

  const { inlineDiffTask } = conversationAction.state

  const openFileInEditor = async () => {
    const schemeUri = fileInfo?.schemeUri

    if (!schemeUri) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        schemeUri
      }
    })
  }

  const renderActionButton = () => {
    if (inlineDiffTask?.state === InlineDiffTaskState.Idle || !inlineDiffTask) {
      return (
        <ButtonWithTooltip
          size="iconXss"
          variant="ghost"
          tooltip="Apply"
          onClick={() =>
            startActionMutation.mutate({
              chatContext: context,
              conversation,
              action: conversationAction
            })
          }
        >
          <PlayIcon className="size-3" />
        </ButtonWithTooltip>
      )
    }

    if (inlineDiffTask?.state === InlineDiffTaskState.Reviewing) {
      return (
        <>
          {/* reject */}
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip="Reject"
            onClick={() =>
              rejectActionMutation.mutate({
                chatContext: context,
                conversation,
                action: conversationAction
              })
            }
          >
            <Cross2Icon className="size-3" />
          </ButtonWithTooltip>

          {/* accept */}
          <ButtonWithTooltip
            size="iconXss"
            variant="default"
            tooltip="Accept"
            onClick={() =>
              acceptActionMutation.mutate({
                chatContext: context,
                conversation,
                action: conversationAction
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
        tooltip="Reapply"
        onClick={() =>
          restartActionMutation.mutate({
            chatContext: context,
            conversation,
            action: conversationAction
          })
        }
      >
        <ReloadIcon className="size-3" />
      </ButtonWithTooltip>
    )
  }

  if (!fileInfo) return null

  return (
    <div
      className={cn(
        'w-full py-0.5 cursor-pointer rounded-md text-sm flex items-center justify-between gap-2 hover:bg-border select-none'
      )}
      onClick={openFileInEditor}
    >
      <div className="flex flex-shrink-0 items-center gap-2">
        {/* title */}
        <FileIcon className="size-4" filePath={fileInfo.schemeUri} />
        <span>{getFileNameFromPath(fileInfo.schemeUri)}</span>

        {inlineDiffTask &&
        ![InlineDiffTaskState.Rejected, InlineDiffTaskState.Error].includes(
          inlineDiffTask.state
        ) ? (
          <span>
            ({inlineDiffTask.waitForReviewDiffBlockIds.length}/
            {inlineDiffTask.originalWaitForReviewDiffBlockIdCount})
          </span>
        ) : null}

        {/* status */}
        {inlineDiffTask?.state === InlineDiffTaskState.Generating && (
          <ButtonWithTooltip
            size="iconXss"
            variant="ghost"
            tooltip="Generating"
          >
            <div className="size-3 border-2 rounded-full animate-spin border-t-primary" />
          </ButtonWithTooltip>
        )}

        {inlineDiffTask?.state === InlineDiffTaskState.Reviewing && (
          <ButtonWithTooltip size="iconXss" variant="ghost" tooltip="Reviewing">
            <DotFilledIcon className="size-3 text-primary" />
          </ButtonWithTooltip>
        )}

        {inlineDiffTask?.state === InlineDiffTaskState.Accepted && (
          <ButtonWithTooltip size="iconXss" variant="ghost" tooltip="Accepted">
            <CheckIcon className="size-3 text-primary" />
          </ButtonWithTooltip>
        )}

        {inlineDiffTask?.state === InlineDiffTaskState.Rejected && (
          <ButtonWithTooltip size="iconXss" variant="ghost" tooltip="Rejected">
            <Cross2Icon className="size-3 text-destructive" />
          </ButtonWithTooltip>
        )}
      </div>

      {/* actions */}
      <div
        className="flex flex-shrink-0 items-center gap-2"
        onClick={e => e.stopPropagation()}
      >
        {renderActionButton()}
      </div>
    </div>
  )
}
