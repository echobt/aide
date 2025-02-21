import { useState } from 'react'
import { api } from '@webview/network/actions-api'
import { CodeEditTaskState, type CodeEditTaskJson } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

export const useApplyCode = (schemeUri: string | undefined, code: string) => {
  const [isApplying, setIsApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState<CodeEditTaskState>(
    CodeEditTaskState.Initial
  )
  const [appliedContent, setAppliedContent] = useState('')

  const handleStream = (task: CodeEditTaskJson) => {
    setAppliedContent(task.newContent)
    setApplyStatus(task.state)

    if (task.state === CodeEditTaskState.Error) {
      logAndToastError('Failed to apply code')
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
            schemeUri,
            code,
            cleanLast: isReapply
          }
        },
        handleStream
      )
    } catch (error) {
      setApplyStatus(CodeEditTaskState.Error)
      logAndToastError('Failed to apply code', error)
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
      toast.info('Code application cancelled')
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
