import type { CommandManager } from '@extension/commands/command-manager'
import { logger } from '@extension/logger'
import { AgentServerPluginRegistry } from '@shared/plugins/agents/_base/server/agent-server-plugin-registry'
import { createAgentServerPlugins } from '@shared/plugins/agents/_base/server/agent-server-plugins'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { MentionServerPluginRegistry } from '@shared/plugins/mentions/_base/server/mention-server-plugin-registry'
import { createMentionServerPlugins } from '@shared/plugins/mentions/_base/server/mention-server-plugins'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

export class ServerPluginRegister extends BaseRegister {
  mentionServerPluginRegistry!: MentionServerPluginRegistry

  agentServerPluginRegistry!: AgentServerPluginRegistry

  disposables: vscode.Disposable[] = []

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    const mentionServerPluginRegistry = new MentionServerPluginRegistry()
    const mentionPlugins = createMentionServerPlugins()
    const agentServerPluginRegistry = new AgentServerPluginRegistry()
    const agentPlugins = createAgentServerPlugins()

    await settledPromiseResults([
      ...mentionPlugins.map(plugin =>
        mentionServerPluginRegistry.loadPlugin(plugin)
      ),
      ...agentPlugins.map(plugin =>
        agentServerPluginRegistry.loadPlugin(plugin)
      )
    ])

    this.mentionServerPluginRegistry = mentionServerPluginRegistry
    this.agentServerPluginRegistry = agentServerPluginRegistry

    // currently, vscode not allow use lm models outside of the ChatParticipant
    // await this.registerVSCodeLMTools()
    // generateVSCodeAIToolsDeclareJson(agentServerPluginRegistry)
  }

  async registerVSCodeLMTools() {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot'
      })
      logger.log('registerVSCodeLMTools models:', models)

      const emptyTool: vscode.LanguageModelTool<{}> = {
        invoke() {
          const result = new vscode.LanguageModelToolResult([])
          return result
        },
        prepareInvocation() {
          const invocation: vscode.PreparedToolInvocation = {
            invocationMessage: t(
              'extension.serverPlugin.vscode.internalToolMessage'
            ),
            confirmationMessages: {
              title: t('extension.serverPlugin.vscode.internalToolTitle'),
              message: t(
                'extension.serverPlugin.vscode.internalToolConfirmMessage'
              )
            }
          }
          return invocation
        }
      }

      Object.values(AgentPluginId).forEach(toolName => {
        const dispose = vscode.lm.registerTool(toolName, emptyTool)
        this.disposables.push(dispose)
      })

      logger.dev.log(
        'registerVSCodeLMTools names:',
        Object.values(AgentPluginId)
      )
    } catch (error) {
      logger.error('registerVSCodeLMTools error:', error)
    }
  }

  async dispose(): Promise<void> {
    this.disposables.forEach(dispose => dispose.dispose())
    await this.mentionServerPluginRegistry.unloadAllPlugins()
  }
}
