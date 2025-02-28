import type { SingleSessionAgentParams } from '@extension/actions/agent-actions'
import { runAction } from '@extension/state'
import type { ActionContext } from '@shared/actions/types'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import type { GetAgent } from '@webview/types/chat'

import { isSameAgent } from '../shared'
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

  isSameAgent = isSameAgent

  async onStartAgent(context: ActionContext<SingleSessionAgentParams>) {
    const agentInfo = await runAction().server.agent.getAgentInfo(context)
    const agent = agentInfo.agent as GetAgent<WebPreviewAgent>
    const { chatContext } = agentInfo

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
