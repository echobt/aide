import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import { runAction } from '@extension/state'
import { ChatContextEntity, type ChatSession } from '@shared/entities'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { BaseTreeItem, BaseTreeProvider } from './_base/tree/base-tree'
import type { TreeActionConfig, TreeItemConfig } from './_base/tree/types'
import { BaseRegister } from './base-register'

class ChatHistoriesTreeItem extends BaseTreeItem {
  constructor(
    public readonly chatSession: ChatSession,
    actions: TreeActionConfig[],
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    const config: TreeItemConfig = {
      id: 'chatHistoriesTreeItem',
      label: chatSession.title,
      description: new Date(chatSession.updatedAt).toLocaleString(),
      tooltip: chatSession.title,
      iconPath: new vscode.ThemeIcon('comment-discussion'),
      collapsibleState,
      clickAction: {
        actionType: 'client',
        actionCategory: 'chat',
        actionName: 'openChatPage',
        actionParams: {
          sessionId: chatSession.id
        }
      },
      data: chatSession
    }

    super(config, actions)
  }
}

class ChatHistoriesTreeProvider extends BaseTreeProvider<ChatHistoriesTreeItem> {
  constructor(
    context: vscode.ExtensionContext,
    registerManager: RegisterManager,
    commandManager: CommandManager
  ) {
    // Define all tree actions
    const actions: TreeActionConfig<ChatHistoriesTreeItem>[] = [
      {
        id: 'refresh',
        title: t('extension.command.chatHistoriesTree.refresh'),
        icon: '$(refresh)',
        handler: () => this.refresh()
      },
      {
        id: 'createAndOpenSession',
        title: t('extension.command.chatHistoriesTree.createAndOpenSession'),
        icon: '$(plus)',
        handler: () => this.createAndOpenSession()
      },
      {
        id: 'deleteSession',
        title: t('extension.command.chatHistoriesTree.deleteSession'),
        icon: '$(trash)',
        showInContextMenu: true,
        handler: item => item && this.deleteSession(item.chatSession.id)
      },
      {
        id: 'duplicateSession',
        title: t('extension.command.chatHistoriesTree.duplicateSession'),
        icon: '$(copy)',
        showInContextMenu: true,
        handler: item => item && this.duplicateSession(item.chatSession.id)
      }
    ]

    super(context, registerManager, commandManager, actions)
  }

  getTreeId(): string {
    return 'chatHistoriesTree'
  }

  async refresh(item?: ChatHistoriesTreeItem | undefined): Promise<void> {
    super.refresh(item)
    await runAction(this.registerManager)?.client.chat.refreshChatSessions({
      actionParams: {}
    })
  }

  async getChildren(): Promise<ChatHistoriesTreeItem[]> {
    const chatSessions = await runAction(
      this.registerManager
    )?.server.chatSession.getAllSessions({
      actionParams: {}
    })

    return (
      chatSessions
        ?.sort((a, b) => b.updatedAt - a.updatedAt)
        ?.map(
          session =>
            new ChatHistoriesTreeItem(
              session,
              this.actions,
              vscode.TreeItemCollapsibleState.None
            )
        ) ?? []
    )
  }

  private async createAndOpenSession(): Promise<void> {
    const session = await runAction(
      this.registerManager
    )?.server.chatSession.createSession({
      actionParams: {
        chatContext: new ChatContextEntity(t).entity
      }
    })

    await this.refresh()

    runAction(this.registerManager)?.client.chat.openChatPage({
      actionParams: {
        sessionId: session.id
      }
    })
  }

  private async duplicateSession(sessionId: string): Promise<void> {
    const session = await runAction(
      this.registerManager
    )?.server.chatSession.duplicateSessionById({
      actionParams: { sessionId }
    })

    await this.refresh()

    runAction(this.registerManager)?.client.chat.openChatPage({
      actionParams: {
        sessionId: session.id
      }
    })
  }

  private async deleteSession(sessionId: string): Promise<void> {
    await runAction(this.registerManager)?.server.chatSession.deleteSession({
      actionParams: { sessionId }
    })

    await this.refresh()
  }
}

export class ChatHistoriesTreeRegister extends BaseRegister {
  private treeDataProvider: ChatHistoriesTreeProvider | undefined

  private treeView: vscode.TreeView<ChatHistoriesTreeItem> | undefined

  register(): void {
    this.treeDataProvider = new ChatHistoriesTreeProvider(
      this.context,
      this.registerManager,
      this.commandManager
    )

    this.treeView = vscode.window.createTreeView('aide.chatHistoriesTree', {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: false,
      canSelectMany: false
    })

    this.context.subscriptions.push(this.treeView)
  }

  dispose(): void {
    this.treeView?.dispose()
  }
}
