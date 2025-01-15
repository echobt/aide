import { useState } from 'react'
import {
  InlineDiffTaskState,
  type InlineDiffTaskJson
} from '@extension/registers/inline-diff-register/types'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

export const useApplyCode = (schemeUri: string | undefined, code: string) => {
  const [isApplying, setIsApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState<InlineDiffTaskState>(
    InlineDiffTaskState.Idle
  )
  const [appliedContent, setAppliedContent] = useState('')

  const handleStream = (task: InlineDiffTaskJson) => {
    setAppliedContent(task.replacementContent)
    setApplyStatus(task.state)

    if (task.state === InlineDiffTaskState.Error) {
      logAndToastError('Failed to apply code')
    }
  }

  const applyCode = async (isReapply = false) => {
    if (!schemeUri) return
    setIsApplying(true)
    setApplyStatus(InlineDiffTaskState.Generating)
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
      setApplyStatus(InlineDiffTaskState.Error)
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
      setApplyStatus(InlineDiffTaskState.Idle)
      toast.info('Code application cancelled')
    }
  }

  const reapplyCode = () => {
    setApplyStatus(InlineDiffTaskState.Idle)
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
