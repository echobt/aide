import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import { logger } from '@extension/logger'
import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import { getErrorMsg } from '@shared/utils/common'
import { cloneDeep } from 'es-toolkit'
import { t } from 'i18next'
import type { WritableDraft } from 'immer'

import { isSameAction } from '../shared'
import type { EditFileAction } from '../types'
import { EditFileAgent } from './edit-file-agent'

export class EditFileAgentServerUtilsProvider
  implements AgentServerUtilsProvider<EditFileAgent>
{
  getAgentClass() {
    return EditFileAgent
  }

  getIsNeedSaveWorkspaceCheckpoint() {
    return true
  }

  isSameAction = isSameAction

  async onStartAction(context: ActionContext<SingleSessionActionParams>) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as EditFileAction
    const { agent, state } = action
    let task = state.codeEditTask

    if (!task) {
      task = await runAction().server.apply.createApplyCodeTask({
        ...context,
        actionParams: {
          schemeUri: agent?.input.targetFilePath || '',
          code: agent?.input.codeEdit || '',
          cleanLast: true
        }
      })
    }
    const streamTask = runAction().server.apply.startApplyCodeTask({
      ...context,
      actionParams: {
        task,
        onTaskChange: () => {
          this.onRefreshAction({
            ...context,
            abortController: new AbortController(),
            actionParams: {
              ...context.actionParams,
              autoRefresh: true
            }
          })
        }
      }
    })

    let lastTask = task
    for await (const task of streamTask) {
      if (lastTask.state !== task.state) {
        await runAction().server.agent.updateCurrentAction({
          ...context,
          actionParams: {
            ...context.actionParams,
            updater: _draft => {
              const draft = _draft as WritableDraft<EditFileAction>
              draft.state.codeEditTask = cloneDeep(task)
            },
            autoRefresh: true
          }
        })
      }
      lastTask = task

      if (task.state === CodeEditTaskState.Error) {
        logger.error(`Failed to apply code`, task.error)
        throw new Error(
          t('shared.plugins.agents.editFile.errors.failedToApplyCode', {
            error: getErrorMsg(task.error)
          })
        )
      }
    }
  }

  async onRestartAction(context: ActionContext<SingleSessionActionParams>) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as EditFileAction
    const { codeEditTask } = action.state

    if (!codeEditTask)
      throw new Error(
        t('shared.plugins.agents.editFile.errors.codeEditTaskNotFound')
      )

    await runAction().server.apply.abortAndCleanApplyCodeTask({
      ...context,
      abortController: new AbortController(),
      actionParams: {
        task: codeEditTask
      }
    })
    await this.onStartAction(context)
  }

  async onAcceptAction(context: ActionContext<SingleSessionActionParams>) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as EditFileAction
    const { codeEditTask } = action.state

    if (!codeEditTask)
      throw new Error(
        t('shared.plugins.agents.editFile.errors.codeEditTaskNotFound')
      )

    const acceptedTask = await runAction().server.apply.acceptApplyCodeTask({
      ...context,
      actionParams: {
        task: codeEditTask
      }
    })

    if (!acceptedTask) return

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as WritableDraft<EditFileAction>
          draft.state.codeEditTask = cloneDeep(acceptedTask)
        }
      }
    })
  }

  async onRejectAction(context: ActionContext<SingleSessionActionParams>) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as EditFileAction
    const { codeEditTask } = action.state

    if (!codeEditTask)
      throw new Error(
        t('shared.plugins.agents.editFile.errors.codeEditTaskNotFound')
      )

    const rejectedTask = await runAction().server.apply.rejectApplyCodeTask({
      ...context,
      actionParams: {
        task: codeEditTask
      }
    })

    if (!rejectedTask) return

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as WritableDraft<EditFileAction>
          draft.state.codeEditTask = cloneDeep(rejectedTask)
        }
      }
    })
  }

  async onRefreshAction(
    context: ActionContext<SingleSessionActionParams>,
    autoRefresh?: boolean
  ) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as EditFileAction
    const { codeEditTask } = action.state

    if (!codeEditTask) return

    const finalTask = await runAction().server.apply.refreshApplyCodeTask({
      ...context,
      actionParams: {
        task: codeEditTask
      }
    })

    if (!finalTask) return

    await runAction().server.agent.updateCurrentAction({
      ...context,
      actionParams: {
        ...context.actionParams,
        autoRefresh: autoRefresh ?? context.actionParams.autoRefresh,
        updater: _draft => {
          const draft = _draft as WritableDraft<EditFileAction>
          draft.state.codeEditTask = cloneDeep(finalTask)
        }
      }
    })
  }
}
