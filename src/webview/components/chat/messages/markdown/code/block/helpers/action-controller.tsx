import { useEffect, useState } from 'react'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { EditFileAction } from '@shared/plugins/agents/edit-file-agent-plugin/types'
import { useMarkdownActionContext } from '@webview/contexts/conversation-action-context/markdown-action-context'
import { api } from '@webview/network/actions-api'
import { useDebounce } from 'react-use'
import { v4 as uuidv4 } from 'uuid'

interface ActionControllerProps {
  originalContent: string
  fileRelativePath: string
}

export const ActionController: React.FC<ActionControllerProps> = ({
  originalContent,
  fileRelativePath
}) => {
  const [debouncedOriginalContent, setDebouncedOriginalContent] = useState('')

  useDebounce(
    () => {
      setDebouncedOriginalContent(originalContent)
    },
    1000,
    [originalContent]
  )

  const { addAction } = useMarkdownActionContext()

  useEffect(() => {
    // add file edit action
    if (!debouncedOriginalContent || !fileRelativePath) return

    addAction<EditFileAction>({
      currentContent: debouncedOriginalContent,
      action: {
        state: {
          inlineDiffTask: null
        },
        agent: {
          id: uuidv4(),
          name: AgentPluginId.EditFile,
          input: {
            blocking: false,
            codeEdit: debouncedOriginalContent,
            instructions: 'Edit the file by composer',
            targetFilePath: fileRelativePath
          },
          output: {
            success: true
          }
        }
      },
      onRemoveSameAction: oldAction => {
        const oldInlineDiffTask = oldAction.state.inlineDiffTask
        if (oldInlineDiffTask) {
          api.actions().server.apply.abortAndCleanApplyCodeTask({
            actionParams: {
              task: oldInlineDiffTask
            }
          })
        }
      }
    })
  }, [debouncedOriginalContent, fileRelativePath])

  return null
}
