import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import { InlineDiffTaskState } from '@extension/registers/inline-diff-register/types'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import { getErrorMsg } from '@shared/utils/common'
import { cloneDeep } from 'es-toolkit'
import type { WritableDraft } from 'immer'
import type { Writeable } from 'zod'

import type { EditFileAction } from '../types'
import { EditFileAgent } from './edit-file-agent'

export class EditFileAgentServerUtilsProvider
  implements AgentServerUtilsProvider<EditFileAgent, EditFileAction>
{
  getAgentClass() {
    return EditFileAgent
  }

  async onStartAction(
    context: ActionContext<SingleSessionActionParams<EditFileAction>>
  ) {
    const { agent } = context.actionParams.action
    const streamTask =
      await runAction().server.apply.createAndStartApplyCodeTask({
        ...context,
        actionParams: {
          path: agent?.input.targetFilePath || '',
          code: agent?.input.codeEdit || '',
          cleanLast: true,
          onTaskChange: () => {
            runAction().server.agent.refreshAction({
              ...context,
              abortController: new AbortController()
            })
          }
        }
      })

    let lastTaskState = InlineDiffTaskState.Idle
    for await (const task of streamTask) {
      if (lastTaskState !== task.state) {
        await runAction().server.agent.updateCurrentAction({
          ...context,
          actionParams: {
            ...context.actionParams,
            updater: _draft => {
              const draft = _draft as WritableDraft<EditFileAction>
              draft.state.inlineDiffTask = cloneDeep(task)
            },
            autoRefresh: true
          }
        })
      }
      lastTaskState = task.state

      if (task.state === InlineDiffTaskState.Error) {
        throw new Error(`Failed to apply code: ${getErrorMsg(task.error)}`)
      }
    }
  }

  async onRestartAction(
    context: ActionContext<SingleSessionActionParams<EditFileAction>>
  ) {
    const { inlineDiffTask } = context.actionParams.action.state
    if (!inlineDiffTask) throw new Error('Inline diff task not found')

    await runAction().server.apply.abortAndCleanApplyCodeTask({
      ...context,
      abortController: new AbortController(),
      actionParams: {
        task: inlineDiffTask
      }
    })
    await this.onStartAction(context)
  }

  async onAcceptAction(
    context: ActionContext<SingleSessionActionParams<EditFileAction>>
  ) {
    const { inlineDiffTask } = context.actionParams.action.state
    if (!inlineDiffTask) throw new Error('Inline diff task not found')
    const acceptedTask = await runAction().server.apply.acceptApplyCodeTask({
      ...context,
      actionParams: {
        task: inlineDiffTask
      }
    })

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as Writeable<EditFileAction>
          draft.state.inlineDiffTask = acceptedTask
        }
      }
    })
  }

  async onRejectAction(
    context: ActionContext<SingleSessionActionParams<EditFileAction>>
  ) {
    const { inlineDiffTask } = context.actionParams.action.state
    if (!inlineDiffTask) throw new Error('Inline diff task not found')
    const rejectedTask = await runAction().server.apply.rejectApplyCodeTask({
      ...context,
      actionParams: {
        task: inlineDiffTask
      }
    })

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as Writeable<EditFileAction>
          draft.state.inlineDiffTask = rejectedTask
        }
      }
    })
  }

  async onRefreshAction(
    context: ActionContext<SingleSessionActionParams<EditFileAction>>
  ) {
    const { inlineDiffTask } = context.actionParams.action.state
    if (!inlineDiffTask) throw new Error('Inline diff task not found')
    const finalTask = await runAction().server.apply.refreshApplyCodeTask({
      ...context,
      actionParams: {
        task: inlineDiffTask
      }
    })

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as Writeable<EditFileAction>
          draft.state.inlineDiffTask = finalTask
        }
      }
    })
  }
}
