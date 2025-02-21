import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { Conversation, ConversationAction } from '@shared/entities'
import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'
import type { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { settledPromiseResults } from '@shared/utils/common'
import { produce } from 'immer'
import type { DraftFunction } from 'use-immer'

export type SingleSessionActionParams = {
  sessionId: string
  conversationId: string
  actionId: string
  autoRefresh?: boolean
}

export type MultipleSessionActionParams = {
  sessionId: string
  actionItems: { conversationId: string; actionId: string }[]
  autoRefresh?: boolean
}

type ActionHandlerType =
  | 'onAcceptAction'
  | 'onRejectAction'
  | 'onStartAction'
  | 'onRestartAction'
  | 'onRefreshAction'

type ActionMethodType = 'acceptAction' | 'rejectAction' | 'refreshAction'

export class AgentActionsCollection extends ServerActionCollection {
  readonly categoryName = 'agent'

  private actionIdAbortControllerMap: Record<string, AbortController> = {}

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

  async getActionInfo(
    context: ActionContext<
      Pick<
        SingleSessionActionParams,
        'sessionId' | 'conversationId' | 'actionId'
      >
    >
  ) {
    const { sessionId, conversationId, actionId } = context.actionParams

    const chatContext = await runAction(
      this.registerManager
    ).server.chatSession.getChatContext({
      ...context,
      actionParams: {
        sessionId
      }
    })
    if (!chatContext) throw new Error('Chat context not found')

    const conversation = chatContext.conversations.find(
      c => c.id === conversationId
    )
    if (!conversation) throw new Error('Conversation not found')

    const action = conversation.actions.find(a => a.id === actionId)
    if (!action) throw new Error('Action not found')

    return { chatContext, conversation, action }
  }

  async abortAction(context: ActionContext<SingleSessionActionParams>) {
    const { actionId } = context.actionParams
    const abortController = this.actionIdAbortControllerMap[actionId]
    if (abortController) {
      abortController.abort()
    }
    delete this.actionIdAbortControllerMap[actionId]
  }

  async isSameAction(
    context: ActionContext<
      Omit<SingleSessionActionParams, 'actionId'> & {
        actionIdA: string
        actionIdB: string
      }
    >
  ) {
    const { actionIdA, actionIdB } = context.actionParams
    if (actionIdA === actionIdB) return true
    const { action: actionA, conversation } = await this.getActionInfo({
      ...context,
      actionParams: {
        ...context.actionParams,
        actionId: actionIdA
      }
    })
    const actionB = conversation.actions.find(a => a.id === actionIdB)

    if (!actionA || !actionB) return false
    if (!actionA.agent?.name || !actionB.agent?.name) return false
    if (actionA.agent?.name !== actionB.agent?.name) return false

    const serverPluginRegister =
      this.registerManager.getRegister(ServerPluginRegister)
    const idProviderMap =
      serverPluginRegister?.agentServerPluginRegistry?.providerManagers.serverUtils.getIdProviderMap()

    if (!idProviderMap) {
      throw new Error('ServerUtilsProviders not found')
    }
    const { isSameAction } = idProviderMap[actionA.agent.name as AgentPluginId]
    if (!isSameAction) return false

    return isSameAction(actionA, actionB)
  }

  private async handleAction(
    context: ActionContext<SingleSessionActionParams>,
    handlerType: ActionHandlerType
  ) {
    const { webviewId, abortController = new AbortController() } = context
    const { autoRefresh = true } = context.actionParams

    const { action, conversation } = await this.getActionInfo(context)
    const provider = this.getAgentServerUtilsProvider(action?.agent?.name)

    if (this.isStartOrRestartAction(handlerType)) {
      await this.abortExistingSameActions(context, conversation, action)
      this.actionIdAbortControllerMap[action.id] = abortController
    }

    await provider[handlerType]?.(context)

    if (autoRefresh) {
      await this.refreshChatSession(webviewId)
    }
  }

  private isStartOrRestartAction(handlerType: ActionHandlerType): boolean {
    return ['onStartAction', 'onRestartAction'].includes(handlerType)
  }

  private async abortExistingSameActions(
    context: ActionContext<SingleSessionActionParams>,
    conversation: Conversation,
    action: ConversationAction
  ) {
    await settledPromiseResults(
      conversation.actions.map(async a => {
        const isSame = await this.isSameAction({
          ...context,
          actionParams: {
            ...context.actionParams,
            actionIdA: action.id,
            actionIdB: a.id
          }
        })
        if (isSame) {
          await this.abortAction({
            ...context,
            actionParams: {
              ...context.actionParams,
              actionId: a.id
            }
          })
        }
      })
    )
  }

  private async handleMultipleActions(
    context: ActionContext<MultipleSessionActionParams>,
    handlerType: ActionMethodType
  ) {
    const { webviewId } = context
    const { sessionId, actionItems, autoRefresh = true } = context.actionParams

    await settledPromiseResults(
      actionItems.map(item =>
        this[handlerType]({
          ...context,
          actionParams: {
            sessionId,
            conversationId: item.conversationId,
            actionId: item.actionId,
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
    const { autoRefresh, sessionId, conversationId, actionId } =
      context.actionParams
    const { action } = await this.getActionInfo(context)
    const provider = this.getAgentServerUtilsProvider(action.agent?.name)

    await this.handleWorkspaceCheckpoint(
      context,
      provider,
      sessionId,
      conversationId,
      actionId,
      autoRefresh
    )
    await this.handleAction(context, 'onStartAction')
  }

  private async handleWorkspaceCheckpoint(
    context: ActionContext<SingleSessionActionParams>,
    provider: AgentServerUtilsProvider,
    sessionId: string,
    conversationId: string,
    actionId: string,
    autoRefresh?: boolean
  ) {
    const isNeedSaveWorkspaceCheckpoint =
      (await provider?.getIsNeedSaveWorkspaceCheckpoint?.()) ?? false

    if (isNeedSaveWorkspaceCheckpoint) {
      const workspaceCheckpointHash = await runAction(
        this.registerManager
      ).server.workspaceCheckpoint.createCheckpoint({
        actionParams: { message: 'Checkpoint' }
      })

      await this.updateCurrentAction({
        ...context,
        actionParams: {
          sessionId,
          conversationId,
          actionId,
          updater: draft => {
            draft.workspaceCheckpointHash = workspaceCheckpointHash
          },
          autoRefresh
        }
      })
    }
  }

  async restartAction(context: ActionContext<SingleSessionActionParams>) {
    await this.handleAction(context, 'onRestartAction')
  }

  async updateCurrentAction(
    context: ActionContext<{
      sessionId: string
      conversationId: string
      actionId: string
      updater: ConversationAction | DraftFunction<ConversationAction>
      autoRefresh?: boolean
    }>
  ) {
    const { webviewId } = context
    const {
      actionId,
      conversationId,
      updater,
      autoRefresh = false
    } = context.actionParams

    const { chatContext } = await this.getActionInfo(context)

    const newChatContext = produce(chatContext, draft => {
      const conversationIndex = draft!.conversations.findIndex(
        c => c.id === conversationId
      )

      const actionIndex = draft!.conversations[
        conversationIndex
      ]!.actions.findIndex(a => a.id === actionId)

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
      await this.refreshChatSession(webviewId)
    }
  }
}
