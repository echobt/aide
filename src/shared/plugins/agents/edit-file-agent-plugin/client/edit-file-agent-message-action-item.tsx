/* eslint-disable unused-imports/no-unused-vars */
import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import type { SFC } from '@shared/types/common'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { FileIcon } from '@webview/components/file-icon'
import {
  CollapsibleBlock,
  type CollapsibleBlockStatus
} from '@webview/components/ui/collapsible-block'
import { Highlighter } from '@webview/components/ui/highlighter'
import { useGetFullPath } from '@webview/hooks/api/use-get-full-path'
import { api } from '@webview/network/actions-api'
import { copyToClipboard } from '@webview/utils/api'
import { getFileNameFromPath } from '@webview/utils/path'
import { getShikiLanguage } from '@webview/utils/shiki'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import type { CustomRenderMessageActionItemProps } from '../../_base/client/agent-client-plugin-types'
import type { EditFileAction } from '../types'

export const EditFileAgentMessageActionItem: SFC<
  CustomRenderMessageActionItemProps<EditFileAction>
> = ({ conversationAction, setConversationAction }) => {
  const { targetFilePath, codeEdit } = conversationAction.agent!.input

  const { data: fullPath } = useGetFullPath({
    schemeUri: targetFilePath,
    returnNullIfNotExists: false
  })

  const shikiLang = getShikiLanguage({
    unknownLang: 'typescript',
    path: targetFilePath
  })

  const copy = async () => {
    await copyToClipboard(codeEdit)
    toast.success('Code copied to clipboard')
  }

  const openFileInEditor = async () => {
    if (!fullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        schemeUri: fullPath
      }
    })
  }

  const renderActions = () => (
    <>
      <ButtonWithTooltip
        onClick={copy}
        size="iconXs"
        variant="ghost"
        tooltip="Copy"
        aria-label="Copy code"
      >
        <CopyIcon className="size-3" />
      </ButtonWithTooltip>
    </>
  )

  const renderFileName = () =>
    targetFilePath ? (
      <div className="flex shrink-0 items-center mr-2">
        <FileIcon className="size-3 mr-1" filePath={targetFilePath} />
        <span>{getFileNameFromPath(targetFilePath)}</span>
      </div>
    ) : null

  const stateMap: Record<CodeEditTaskState, CollapsibleBlockStatus> = {
    [CodeEditTaskState.Initial]: 'idle',
    [CodeEditTaskState.Generating]: 'loading',
    [CodeEditTaskState.WaitingForReview]: 'waiting',
    [CodeEditTaskState.Accepted]: 'success',
    [CodeEditTaskState.Rejected]: 'error',
    [CodeEditTaskState.Error]: 'error'
  }

  return (
    <CollapsibleBlock
      title={renderFileName() || shikiLang}
      actionSlot={renderActions()}
      status={
        stateMap[
          conversationAction.state.codeEditTask?.state as CodeEditTaskState
        ] || 'idle'
      }
      defaultExpanded={false}
      onClickTitle={() => openFileInEditor()}
    >
      <Highlighter language={shikiLang} content={codeEdit} />
    </CollapsibleBlock>
  )
}
