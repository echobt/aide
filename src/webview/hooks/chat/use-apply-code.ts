import { useState } from 'react'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { CodeEditTaskState, type CodeEditTaskJson } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export interface UseApplyCodeProps {
  schemeUri: string | undefined
  code: string
  conversationId: string
  agentId: string
}

export const useApplyCode = ({
  schemeUri,
  code,
  conversationId,
  agentId
}: UseApplyCodeProps) => {
  const { t } = useTranslation()
  const [isApplying, setIsApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState<CodeEditTaskState>(
    CodeEditTaskState.Initial
  )
  const [appliedContent, setAppliedContent] = useState('')
  const { context } = useChatContext()

  const handleStream = (task: CodeEditTaskJson) => {
    setAppliedContent(task.newContent)
    setApplyStatus(task.state)

    if (task.state === CodeEditTaskState.Error) {
      logAndToastError(t('webview.code.failedToApply'))
    }
  }

  const applyCode = async (isReapply = false) => {
    if (!schemeUri) return
    setIsApplying(true)
    setApplyStatus(CodeEditTaskState.Generating)
    try {
      await api.actions().server.apply.createAndStartApplyCodeTask(
        {
          actionParams: {
            sessionId: context.id,
            conversationId,
            agentId,
            schemeUri,
            code,
            cleanLast: isReapply
          }
        },
        handleStream
      )
    } catch (error) {
      setApplyStatus(CodeEditTaskState.Error)
      logAndToastError(t('webview.code.failedToApply'), error)
    } finally {
      setIsApplying(false)
    }
  }

  const cancelApply = () => {
    if (schemeUri) {
      api.actions().server.apply.abortAndCleanApplyCodeTaskByPath({
        actionParams: { schemeUri }
      })
      setIsApplying(false)
      setApplyStatus(CodeEditTaskState.Initial)
      toast.info(t('webview.code.applicationCancelled'))
    }
  }

  const reapplyCode = () => {
    setApplyStatus(CodeEditTaskState.Initial)
    setAppliedContent('')
    applyCode(true)
  }

  return {
    isApplying,
    applyStatus,
    appliedContent,
    applyCode,
    cancelApply,
    reapplyCode
  }
}
