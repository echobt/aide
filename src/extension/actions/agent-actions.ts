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
import { cloneDeep } from 'es-toolkit'
import { produce } from 'immer'
import type { DraftFunction } from 'use-immer'

export type SingleSessionActionParams<
  ActionType extends ConversationAction = ConversationAction
> = {
  chatContext: ChatContext
  conversation: Conversation
  action: ActionType
  autoRefresh?: boolean
}

export type MultipleSessionActionParams<
  ActionType extends ConversationAction = ConversationAction
> = {
  chatContext: ChatContext
  actionItems: { conversation: Conversation; action: ActionType }[]
  autoRefresh?: boolean
}

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
    context: ActionContext<SingleSessionActionParams>,
    handlerType:
      | 'onAcceptAction'
      | 'onRejectAction'
      | 'onStartAction'
      | 'onRestartAction'
      | 'onRefreshAction'
  ) {
    const { action, autoRefresh = true } = context.actionParams

    const provider = this.getAgentServerUtilsProvider(action.agent?.name)

    await provider[handlerType]?.(context)

    if (autoRefresh) {
      await this.refreshChatSession()
    }
  }

  private async handleMultipleActions(
    context: ActionContext<MultipleSessionActionParams>,
    handlerType: 'acceptAction' | 'rejectAction' | 'refreshAction'
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

  async acceptAction(context: ActionContext<SingleSessionActionParams>) {
    await this.handleAction(context, 'onAcceptAction')
  }

  async rejectAction(context: ActionContext<SingleSessionActionParams>) {
    await this.handleAction(context, 'onRejectAction')
  }

  async refreshAction(context: ActionContext<SingleSessionActionParams>) {
    await this.handleAction(context, 'onRefreshAction')
  }

  async acceptMultipleActions(
    context: ActionContext<MultipleSessionActionParams>
  ) {
    await this.handleMultipleActions(context, 'acceptAction')
  }

  async rejectMultipleActions(
    context: ActionContext<MultipleSessionActionParams>
  ) {
    await this.handleMultipleActions(context, 'rejectAction')
  }

  async refreshMultipleActions(
    context: ActionContext<MultipleSessionActionParams>
  ) {
    await this.handleMultipleActions(context, 'refreshAction')
  }

  async startAction(context: ActionContext<SingleSessionActionParams>) {
    const { action, chatContext, conversation, autoRefresh } =
      context.actionParams
    const provider = this.getAgentServerUtilsProvider(action.agent?.name)
    const isNeedSaveWorkspaceCheckpoint =
      (await provider?.getIsNeedSaveWorkspaceCheckpoint?.()) ?? false

    if (isNeedSaveWorkspaceCheckpoint) {
      const workspaceCheckpointHash = await runAction(
        this.registerManager
      ).server.workspaceCheckpoint.createCheckpoint({
        actionParams: {
          message: 'Checkpoint'
        }
      })

      await this.updateCurrentAction({
        ...context,
        actionParams: {
          sessionId: chatContext.id,
          conversation,
          action,
          updater: draft => {
            draft.workspaceCheckpointHash = workspaceCheckpointHash
          },
          autoRefresh
        }
      })
    }

    await this.handleAction(context, 'onStartAction')
  }

  async restartAction(context: ActionContext<SingleSessionActionParams>) {
    await this.handleAction(context, 'onRestartAction')
  }

  async updateCurrentAction(
    context: ActionContext<{
      sessionId: string
      conversation: Conversation
      action: ConversationAction
      updater: ConversationAction | DraftFunction<ConversationAction>
      autoRefresh?: boolean
    }>
  ) {
    const {
      sessionId,
      conversation,
      action,
      updater,
      autoRefresh = false
    } = context.actionParams

    const chatContext = cloneDeep(
      await runAction(this.registerManager).server.chatSession.getChatContext({
        actionParams: {
          sessionId
        }
      })
    )

    if (!chatContext) throw new Error('Chat context not found')

    const conversationIndex = chatContext.conversations.findIndex(
      c => c.id === conversation.id
    )

    if (conversationIndex === -1) throw new Error('Conversation not found')

    let actionIndex = chatContext.conversations[
      conversationIndex
    ]!.actions.findIndex(a => a.id === action.id)

    const updatedAction = cloneDeep(action)

    const newChatContext = produce(chatContext, draft => {
      if (actionIndex === -1) {
        draft!.conversations[conversationIndex]!.actions.push(updatedAction)
        actionIndex =
          draft!.conversations[conversationIndex]!.actions.length - 1
      }

      if (typeof updater === 'function') {
        updater(draft!.conversations[conversationIndex]!.actions[actionIndex]!)
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

    if (autoRefresh) {
      await this.refreshChatSession()
    }
  }
}
