import type { CommandManager } from '@extension/commands/command-manager'
import { runAction } from '@extension/state'
import type { AllActionsConfigs } from '@shared/actions/types'
import { ChatContextEntity, type ChatSession } from '@shared/entities'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

class ChatHistoriesTreeItem extends vscode.TreeItem {
  constructor(
    public readonly chatSession: ChatSession,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    private treeDataProvider: ChatHistoriesTreeProvider
  ) {
    super(
      {
        label: chatSession.title,
        highlights: []
      },
      collapsibleState
    )

    // Define all available actions for this item
    const actions: string[] = ['deleteSession', 'duplicateSession']

    // Generate contextValue from all actions
    this.contextValue = [
      'chatHistoriesTreeItem',
      ...actions.map(a => `action:${a}`)
    ].join(',')

    this.iconPath = new vscode.ThemeIcon('comment-discussion')
    this.description = this.formatDate(new Date(chatSession.createdAt))
    this.tooltip = this.chatSession.title

    this.updateCommand()
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleString()
  }

  updateCommand() {
    if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
      // For files
      this.command = {
        command: 'aide.action',
        title: 'Open Chat Session',
        arguments: [
          {
            actionType: 'client',
            actionCategory: 'chat',
            actionName: 'openChatPage',
            actionParams: {
              sessionId: this.chatSession.id
            }
          } satisfies AllActionsConfigs['context']
        ]
      }
    }
  }
}

class ChatHistoriesTreeProvider
  implements vscode.TreeDataProvider<ChatHistoriesTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ChatHistoriesTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ChatHistoriesTreeItem | undefined | null | void>()

  readonly onDidChangeTreeData: vscode.Event<
    ChatHistoriesTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {}

  refresh(item?: ChatHistoriesTreeItem): void {
    this._onDidChangeTreeData.fire(item)
  }

  async createAndOpenSession(): Promise<void> {
    const session = await runAction(
      this.registerManager
    )?.server.chatSession.createSession({
      actionParams: {
        chatContext: new ChatContextEntity().entity
      }
    })

    if (!session) return

    this.refresh()

    runAction(this.registerManager)?.client.chat.openChatPage({
      actionParams: {
        refreshSessions: true,
        sessionId: session.id
      }
    })
  }

  async duplicateSession(sessionId: string): Promise<void> {
    const session = await runAction(
      this.registerManager
    )?.server.chatSession.duplicateSessionById({
      actionParams: { sessionId }
    })

    if (!session) return

    this.refresh()

    runAction(this.registerManager)?.client.chat.openChatPage({
      actionParams: {
        refreshSessions: true,
        sessionId: session.id
      }
    })
  }

  async deleteSession(sessionId: string): Promise<void> {
    await runAction(this.registerManager)?.server.chatSession.deleteSession({
      actionParams: { sessionId }
    })
    this.refresh()
  }

  getTreeItem(element: ChatHistoriesTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(
    element?: ChatHistoriesTreeItem
  ): Thenable<ChatHistoriesTreeItem[]> {
    if (!element) {
      return this.getSessionTreeItems()
    }
    return Promise.resolve([])
  }

  private async getSessionTreeItems(): Promise<ChatHistoriesTreeItem[]> {
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
              vscode.TreeItemCollapsibleState.None,
              this
            )
        ) ?? []
    )
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

    this.registerCommands()

    this.context.subscriptions.push(this.treeView)
  }

  private registerCommands(): void {
    // Register handlers for all item actions
    const actionCommands: {
      id: string
      handler: (...args: any[]) => any
    }[] = [
      {
        id: 'refresh',
        handler: () => this.treeDataProvider?.refresh()
      },
      {
        id: 'createAndOpenSession',
        handler: () => this.treeDataProvider?.createAndOpenSession()
      },
      {
        id: 'deleteSession',
        handler: async (item: ChatHistoriesTreeItem) => {
          await this.treeDataProvider?.deleteSession(item.chatSession.id)
        }
      },
      {
        id: 'duplicateSession',
        handler: async (item: ChatHistoriesTreeItem) => {
          await this.treeDataProvider?.duplicateSession(item.chatSession.id)
        }
      }
      // Easy to add more command handlers:
      // { id: 'duplicate', handler: async (item) => { ... } },
      // { id: 'export', handler: async (item) => { ... } },
    ]

    const actionDisposables = actionCommands.map(({ id, handler }) =>
      vscode.commands.registerCommand(`aide.chatHistoriesTree.${id}`, handler)
    )

    this.context.subscriptions.push(...actionDisposables)
  }

  dispose(): void {
    this.treeView?.dispose()
  }
}
