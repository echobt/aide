import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type {
  ChatContext,
  Conversation,
  ConversationAction
} from '@shared/entities'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import { produce } from 'immer'
import type { DraftFunction } from 'use-immer'

export class AgentActionsCollection extends ServerActionCollection {
  readonly categoryName = 'agent'

  private getAgentServerUtilsProviderMap(): Record<
    string,
    AgentServerUtilsProvider
  > {
    const agentServerPluginRegister =
      this.registerManager.getRegister(ServerPluginRegister)
    const agentServerUtilsProviderMap =
      agentServerPluginRegister?.agentServerPluginRegistry?.providerManagers.serverUtils.getIdProviderMap()

    if (!agentServerUtilsProviderMap) {
      throw new Error('AgentServerUtilsProviders not found')
    }

    return agentServerUtilsProviderMap
  }

  private getAgentServerUtilsProvider(
    agentName: string | undefined
  ): AgentServerUtilsProvider {
    if (!agentName) {
      throw new Error('Agent name not found')
    }

    const agentServerUtilsProviderMap = this.getAgentServerUtilsProviderMap()
    const provider = agentServerUtilsProviderMap[agentName]

    if (!provider) {
      throw new Error(`AgentServerUtilsProvider not found for ${agentName}`)
    }

    return provider
  }

  private async handleAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      autoRefresh?: boolean
    }>,
    handlerType:
      | 'onAcceptAction'
      | 'onRejectAction'
      | 'onStartAction'
      | 'onRestartAction'
  ) {
    const { action, autoRefresh = true } = context.actionParams
    const provider = this.getAgentServerUtilsProvider(action.agent?.name)

    await provider[handlerType]?.(context)

    if (autoRefresh) {
      await this.refreshChatSession()
    }
  }

  private async handleMultipleActions(
    context: ActionContext<{
      chatContext: ChatContext
      actionItems: {
        conversation: Conversation
        action: ConversationAction
      }[]
      autoRefresh?: boolean
    }>,
    handlerType: 'acceptAction' | 'rejectAction'
  ) {
    const {
      chatContext,
      actionItems,
      autoRefresh = true
    } = context.actionParams

    for (const actionItem of actionItems) {
      await this[handlerType]({
        ...context,
        actionParams: {
          chatContext,
          conversation: actionItem.conversation,
          action: actionItem.action,
          autoRefresh: false
        }
      })
    }

    if (autoRefresh) {
      await this.refreshChatSession()
    }
  }

  private async refreshChatSession() {
    await runAction(this.registerManager).client.chat.refreshCurrentChatSession(
      {
        actionParams: {}
      }
    )
  }

  async acceptAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      autoRefresh?: boolean
    }>
  ) {
    await this.handleAction(context, 'onAcceptAction')
  }

  async rejectAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      autoRefresh?: boolean
    }>
  ) {
    await this.handleAction(context, 'onRejectAction')
  }

  async acceptMultipleActions(
    context: ActionContext<{
      chatContext: ChatContext
      actionItems: {
        conversation: Conversation
        action: ConversationAction
      }[]
      autoRefresh?: boolean
    }>
  ) {
    await this.handleMultipleActions(context, 'acceptAction')
  }

  async rejectMultipleActions(
    context: ActionContext<{
      chatContext: ChatContext
      actionItems: {
        conversation: Conversation
        action: ConversationAction
      }[]
      autoRefresh?: boolean
    }>
  ) {
    await this.handleMultipleActions(context, 'rejectAction')
  }

  async startAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      autoRefresh?: boolean
    }>
  ) {
    await this.handleAction(context, 'onStartAction')
  }

  async restartAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      autoRefresh?: boolean
    }>
  ) {
    await this.handleAction(context, 'onRestartAction')
  }

  async updateCurrentAction(
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
      updater: ConversationAction | DraftFunction<ConversationAction>
    }>
  ) {
    const {
      chatContext: oldChatContext,
      conversation,
      action,
      updater
    } = context.actionParams

    const chatContext = await runAction(
      this.registerManager
    ).server.chatSession.getChatContext({
      actionParams: {
        sessionId: oldChatContext.id
      }
    })

    if (!chatContext) throw new Error('Chat context not found')

    const conversationIndex = chatContext.conversations.findIndex(
      c => c.id === conversation.id
    )

    if (conversationIndex === -1) throw new Error('Conversation not found')

    const actionIndex = chatContext.conversations[
      conversationIndex
    ]!.actions.findIndex(a => a.id === action.id)

    if (actionIndex === -1) throw new Error('Action not found')

    const currentChatContext = await runAction(
      this.registerManager
    ).server.chatSession.getChatContext({
      actionParams: {
        sessionId: chatContext.id
      }
    })

    const newChatContext = produce(currentChatContext, draft => {
      const action =
        draft!.conversations[conversationIndex]!.actions[actionIndex]!
      if (typeof updater === 'function') {
        updater(action)
      } else {
        draft!.conversations[conversationIndex]!.actions[actionIndex] = updater
      }
    })

    await runAction().server.chatSession.updateSession({
      ...context,
      actionParams: {
        chatContext: newChatContext!
      }
    })
  }
}
