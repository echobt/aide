import type { CommandManager } from '@extension/commands/command-manager'
import { AgentServerPluginRegistry } from '@shared/plugins/agents/_base/server/agent-server-plugin-registry'
import { createAgentServerPlugins } from '@shared/plugins/agents/_base/server/agent-server-plugins'
import { MentionServerPluginRegistry } from '@shared/plugins/mentions/_base/server/mention-server-plugin-registry'
import { createMentionServerPlugins } from '@shared/plugins/mentions/_base/server/mention-server-plugins'
import { settledPromiseResults } from '@shared/utils/common'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

export class ServerPluginRegister extends BaseRegister {
  mentionServerPluginRegistry!: MentionServerPluginRegistry

  agentServerPluginRegistry!: AgentServerPluginRegistry

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
  }

  async dispose(): Promise<void> {
    await this.mentionServerPluginRegistry.unloadAllPlugins()
  }
}
