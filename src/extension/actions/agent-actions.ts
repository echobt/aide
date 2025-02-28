import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { Agent, Conversation } from '@shared/entities'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import type { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'
import { produce } from 'immer'
import type { DraftFunction } from 'use-immer'

export type SingleSessionAgentParams = {
  sessionId: string
  conversationId: string
  agentId: string
  autoRefresh?: boolean
}

export type MultipleSessionAgentParams = {
  sessionId: string
  agentItems: { conversationId: string; agentId: string }[]
  autoRefresh?: boolean
}

type AgentHandlerType =
  | 'onAcceptAgent'
  | 'onRejectAgent'
  | 'onStartAgent'
  | 'onRestartAgent'
  | 'onRefreshAgent'

type AgentMethodType = 'acceptAgent' | 'rejectAgent' | 'refreshAgent'

export class AgentActionsCollection extends ServerActionCollection {
  readonly categoryName = 'agent'

  private agentIdAbortControllerMap: Record<string, AbortController> = {}

  private getAgentServerUtilsProviderMap(): Record<
    string,
    AgentServerUtilsProvider
  > {
    const agentServerPluginRegister =
      this.registerManager.getRegister(ServerPluginRegister)
    const agentServerUtilsProviderMap =
      agentServerPluginRegister?.agentServerPluginRegistry?.providerManagers.serverUtils.getIdProviderMap()

    if (!agentServerUtilsProviderMap) {
      throw new Error(
        t('extension.agentActions.agentServerUtilsProvidersNotFound')
      )
    }

    return agentServerUtilsProviderMap
  }

  private getAgentServerUtilsProvider(
    agentName: string | undefined
  ): AgentServerUtilsProvider {
    if (!agentName) {
      throw new Error(t('extension.agentActions.agentNameNotFound'))
    }

    const agentServerUtilsProviderMap = this.getAgentServerUtilsProviderMap()
    const provider = agentServerUtilsProviderMap[agentName]

    if (!provider) {
      throw new Error(
        t('extension.agentActions.agentServerUtilsProviderNotFound', {
          agentName
        })
      )
    }

    return provider
  }

  async getAgentInfo(
    context: ActionContext<
      Pick<SingleSessionAgentParams, 'sessionId' | 'conversationId' | 'agentId'>
    >
  ) {
    const { sessionId, conversationId, agentId } = context.actionParams

    const chatContext = await runAction(
      this.registerManager
    ).server.chatSession.getChatContext({
      ...context,
      actionParams: {
        sessionId
      }
    })
    if (!chatContext)
      throw new Error(t('extension.agentActions.chatContextNotFound'))

    const conversation = chatContext.conversations.find(
      c => c.id === conversationId
    )
    if (!conversation)
      throw new Error(t('extension.agentActions.conversationNotFound'))

    const agent = conversation.agents?.find(a => a.id === agentId)
    if (!agent) throw new Error(t('extension.agentActions.agentNotFound'))

    return { chatContext, conversation, agent }
  }

  async abortAgent(context: ActionContext<SingleSessionAgentParams>) {
    const { agentId } = context.actionParams
    const abortController = this.agentIdAbortControllerMap[agentId]
    if (abortController) {
      abortController.abort()
    }
    delete this.agentIdAbortControllerMap[agentId]
  }

  async isSameAgent(
    context: ActionContext<
      Omit<SingleSessionAgentParams, 'actionId'> & {
        agentIdA: string
        agentIdB: string
      }
    >
  ) {
    const { agentIdA, agentIdB } = context.actionParams
    if (agentIdA === agentIdB) return true
    const { agent: agentA, conversation } = await this.getAgentInfo({
      ...context,
      actionParams: {
        ...context.actionParams,
        agentId: agentIdA
      }
    })
    const agentB = conversation.agents?.find(a => a.id === agentIdB)

    if (!agentA || !agentB) return false
    if (!agentA.name || !agentB.name) return false
    if (agentA.name !== agentB.name) return false

    const serverPluginRegister =
      this.registerManager.getRegister(ServerPluginRegister)
    const idProviderMap =
      serverPluginRegister?.agentServerPluginRegistry?.providerManagers.serverUtils.getIdProviderMap()

    if (!idProviderMap) {
      throw new Error(t('extension.agentActions.serverUtilsProvidersNotFound'))
    }
    const { isSameAgent } = idProviderMap[agentA.name as AgentPluginId]
    if (!isSameAgent) return false

    return isSameAgent(agentA, agentB)
  }

  private async handleAgent(
    context: ActionContext<SingleSessionAgentParams>,
    handlerType: AgentHandlerType
  ) {
    const { webviewId, abortController = new AbortController() } = context
    const { autoRefresh = true } = context.actionParams

    const { agent, conversation } = await this.getAgentInfo(context)
    const provider = this.getAgentServerUtilsProvider(agent?.name)

    if (this.isStartOrRestartAgent(handlerType)) {
      await this.abortExistingSameAgents(context, conversation, agent)
      this.agentIdAbortControllerMap[agent.id] = abortController
    }

    await provider[handlerType]?.(context)

    if (autoRefresh) {
      await this.refreshChatSession(webviewId)
    }
  }

  private isStartOrRestartAgent(handlerType: AgentHandlerType): boolean {
    return ['onStartAgent', 'onRestartAgent'].includes(handlerType)
  }

  private async abortExistingSameAgents(
    context: ActionContext<SingleSessionAgentParams>,
    conversation: Conversation,
    agent: Agent
  ) {
    await settledPromiseResults(
      conversation.agents?.map(async a => {
        const isSame = await this.isSameAgent({
          ...context,
          actionParams: {
            ...context.actionParams,
            agentIdA: agent.id,
            agentIdB: a.id
          }
        })
        if (isSame) {
          await this.abortAgent({
            ...context,
            actionParams: {
              ...context.actionParams,
              agentId: a.id
            }
          })
        }
      }) || []
    )
  }

  private async handleMultipleAgents(
    context: ActionContext<MultipleSessionAgentParams>,
    handlerType: AgentMethodType
  ) {
    const { webviewId } = context
    const { sessionId, agentItems, autoRefresh = true } = context.actionParams

    await settledPromiseResults(
      agentItems.map(item =>
        this[handlerType]({
          ...context,
          actionParams: {
            sessionId,
            conversationId: item.conversationId,
            agentId: item.agentId,
            autoRefresh: false
          }
        })
      )
    )

    if (autoRefresh) {
      await this.refreshChatSession(webviewId)
    }
  }

  private async refreshChatSession(webviewId?: string) {
    await runAction(this.registerManager).client.chat.refreshCurrentChatSession(
      {
        actionParams: {},
        webviewId
      }
    )
  }

  async acceptAgent(context: ActionContext<SingleSessionAgentParams>) {
    await this.handleAgent(context, 'onAcceptAgent')
  }

  async rejectAgent(context: ActionContext<SingleSessionAgentParams>) {
    await this.handleAgent(context, 'onRejectAgent')
  }

  async refreshAgent(context: ActionContext<SingleSessionAgentParams>) {
    await this.handleAgent(context, 'onRefreshAgent')
  }

  async acceptMultipleAgents(
    context: ActionContext<MultipleSessionAgentParams>
  ) {
    await this.handleMultipleAgents(context, 'acceptAgent')
  }

  async rejectMultipleAgents(
    context: ActionContext<MultipleSessionAgentParams>
  ) {
    await this.handleMultipleAgents(context, 'rejectAgent')
  }

  async refreshMultipleAgents(
    context: ActionContext<MultipleSessionAgentParams>
  ) {
    await this.handleMultipleAgents(context, 'refreshAgent')
  }

  async startAgent(context: ActionContext<SingleSessionAgentParams>) {
    const { autoRefresh, sessionId, conversationId, agentId } =
      context.actionParams
    const { agent } = await this.getAgentInfo(context)
    const provider = this.getAgentServerUtilsProvider(agent?.name)

    await this.handleWorkspaceCheckpoint(
      context,
      provider,
      sessionId,
      conversationId,
      agentId,
      autoRefresh
    )
    await this.handleAgent(context, 'onStartAgent')
  }

  private async handleWorkspaceCheckpoint(
    context: ActionContext<SingleSessionAgentParams>,
    provider: AgentServerUtilsProvider,
    sessionId: string,
    conversationId: string,
    agentId: string,
    autoRefresh?: boolean
  ) {
    const isNeedSaveWorkspaceCheckpoint =
      (await provider?.getIsNeedSaveWorkspaceCheckpoint?.()) ?? false

    if (isNeedSaveWorkspaceCheckpoint) {
      const workspaceCheckpointHash = await runAction(
        this.registerManager
      ).server.workspaceCheckpoint.createCheckpoint({
        actionParams: { message: t('extension.agentActions.checkpoint') }
      })

      await this.updateCurrentAgent({
        ...context,
        actionParams: {
          sessionId,
          conversationId,
          agentId,
          updater: draft => {
            draft.workspaceCheckpointHash = workspaceCheckpointHash
          },
          autoRefresh
        }
      })
    }
  }

  async restartAgent(context: ActionContext<SingleSessionAgentParams>) {
    await this.handleAgent(context, 'onRestartAgent')
  }

  async updateCurrentAgent(
    context: ActionContext<{
      sessionId: string
      conversationId: string
      agentId: string
      updater: Agent | DraftFunction<Agent>
      autoRefresh?: boolean
    }>
  ) {
    const { webviewId } = context
    const {
      agentId,
      conversationId,
      updater,
      autoRefresh = false
    } = context.actionParams

    const { chatContext } = await this.getAgentInfo(context)

    const newChatContext = produce(chatContext, draft => {
      const conversationIndex = draft!.conversations.findIndex(
        c => c.id === conversationId
      )
      if (!draft!.conversations[conversationIndex]!.agents)
        draft!.conversations[conversationIndex]!.agents = []

      const agentIndex = draft!.conversations[
        conversationIndex
      ]!.agents.findIndex(a => a.id === agentId)

      if (typeof updater === 'function') {
        updater(draft!.conversations[conversationIndex]!.agents[agentIndex]!)
      } else {
        draft!.conversations[conversationIndex]!.agents[agentIndex] = updater
      }
    })

    await runAction().server.chatSession.updateSession({
      ...context,
      actionParams: {
        chatContext: newChatContext!
      }
    })

    if (autoRefresh) {
      await this.refreshChatSession(webviewId)
    }
  }
}
