import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { isSameAction } from '../shared'
import type { WebPreviewAction } from '../types'
import { WebPreviewAgent } from './web-preview-agent'

export class WebPreviewAgentServerUtilsProvider
  implements AgentServerUtilsProvider<WebPreviewAgent>
{
  getAgentClass() {
    return WebPreviewAgent
  }

  getIsNeedSaveWorkspaceCheckpoint() {
    return false
  }

  isSameAction = isSameAction

  async onStartAction(context: ActionContext<SingleSessionActionParams>) {
    const actionInfo = await runAction().server.agent.getActionInfo(context)
    const action = actionInfo.action as WebPreviewAction
    const { chatContext } = actionInfo
    const { agent } = action

    if (!agent) return

    const { name, presetName, files } = agent.input

    await runAction().server.webvm.openWebviewForFullScreen({
      ...context,
      actionParams: {
        sessionId: chatContext.id,
        projectName: name,
        tab: 'preview',
        timestamp: Date.now()
      }
    })

    await runAction().server.webvm.startPreviewVMFiles({
      ...context,
      actionParams: {
        sessionId: chatContext.id,
        projectName: name,
        presetName,
        files
      }
    })
  }
}
