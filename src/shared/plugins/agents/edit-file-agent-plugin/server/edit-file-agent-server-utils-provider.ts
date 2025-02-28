import { logger } from '@extension/logger'
import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import { getErrorMsg } from '@shared/utils/common'
import type {
  CodeEditTaskJson,
  GetAgent,
  SingleSessionAgentParams
} from '@webview/types/chat'
import { cloneDeep } from 'es-toolkit'
import { t } from 'i18next'
import type { WritableDraft } from 'immer'

import { isSameAgent } from '../shared'
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

  isSameAgent = isSameAgent

  async onStartAgent(context: ActionContext<SingleSessionAgentParams>) {
    const { sessionId, conversationId, agentId } = context.actionParams
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<EditFileAgent>
    const { codeEditTask } = agent.output
    let task = codeEditTask

    if (!task) {
      task = await runAction().server.apply.createApplyCodeTask({
        ...context,
        actionParams: {
          sessionId,
          conversationId,
          agentId,
          schemeUri: agent?.input.targetFilePath || '',
          code: agent?.input.codeEdit || '',
          cleanLast: true
        }
      })
    }
    const streamTask = runAction().server.apply.startApplyCodeTask({
      ...context,
      actionParams: {
        task
      }
    })

    const saveAndUpdateAgent = async (task: CodeEditTaskJson) => {
      await runAction().server.agent.updateCurrentAgent({
        ...context,
        actionParams: {
          ...context.actionParams,
          updater: _draft => {
            const draft = _draft as WritableDraft<GetAgent<EditFileAgent>>
            draft.output.codeEditTask = cloneDeep(task)
          },
          autoRefresh: true
        }
      })
    }

    let lastTask = task
    for await (const task of streamTask) {
      if (lastTask.state !== task.state) {
        await saveAndUpdateAgent(task)
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

    await saveAndUpdateAgent(lastTask)
  }

  async onRestartAgent(context: ActionContext<SingleSessionAgentParams>) {
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<EditFileAgent>
    const { codeEditTask } = agent.output

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
    await this.onStartAgent(context)
  }

  async onAcceptAgent(context: ActionContext<SingleSessionAgentParams>) {
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<EditFileAgent>
    const { codeEditTask } = agent.output

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

    await runAction().server.agent.updateCurrentAgent({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as WritableDraft<GetAgent<EditFileAgent>>
          draft.output.codeEditTask = cloneDeep(acceptedTask)
        }
      }
    })
  }

  async onRejectAgent(context: ActionContext<SingleSessionAgentParams>) {
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<EditFileAgent>
    const { codeEditTask } = agent.output

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

    await runAction().server.agent.updateCurrentAgent({
      ...context,
      actionParams: {
        ...context.actionParams,
        updater: _draft => {
          const draft = _draft as WritableDraft<GetAgent<EditFileAgent>>
          draft.output.codeEditTask = cloneDeep(rejectedTask)
        }
      }
    })
  }

  async onRefreshAgent(
    context: ActionContext<SingleSessionAgentParams>,
    autoRefresh?: boolean
  ) {
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<EditFileAgent>
    const { codeEditTask } = agent.output

    if (!codeEditTask) return

    const finalTask = await runAction().server.apply.refreshApplyCodeTask({
      ...context,
      actionParams: {
        task: codeEditTask
      }
    })

    if (!finalTask) return

    await runAction().server.agent.updateCurrentAgent({
      ...context,
      actionParams: {
        ...context.actionParams,
        autoRefresh: autoRefresh ?? context.actionParams.autoRefresh,
        updater: _draft => {
          const draft = _draft as WritableDraft<GetAgent<EditFileAgent>>
          draft.output.codeEditTask = cloneDeep(finalTask)
        }
      }
    })
  }
}
