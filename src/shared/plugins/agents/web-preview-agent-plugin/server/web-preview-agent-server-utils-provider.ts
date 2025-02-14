import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import type { WebPreviewAction } from '../types'
import { WebPreviewAgent } from './web-preview-agent'

export class WebPreviewAgentServerUtilsProvider
  implements AgentServerUtilsProvider<WebPreviewAgent, WebPreviewAction>
{
  getAgentClass() {
    return WebPreviewAgent
  }

  getIsNeedSaveWorkspaceCheckpoint() {
    return false
  }

  async onStartAction(
    context: ActionContext<SingleSessionActionParams<WebPreviewAction>>
  ) {
    const { agent } = context.actionParams.action
    if (!agent) return

    const { chatContext } = context.actionParams
    const { name, presetName, files } = agent.input

    await runAction().server.webvm.openWebviewForFullScreen({
      ...context,
      actionParams: {
        sessionId: chatContext.id,
        projectName: name,
        tab: 'preview'
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
