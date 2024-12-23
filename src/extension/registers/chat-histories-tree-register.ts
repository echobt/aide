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
    public checked: boolean,
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

    // this.checkboxState = vscode.TreeItemCheckboxState.Unchecked
    // this.updateCheckbox()
    this.updateCommand()
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleString()
  }

  updateCheckbox() {
    this.checkboxState = this.checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked
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
    protected commandManager: CommandManager,
    private checkboxStateManager: CheckboxStateManager
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

  async deleteCheckedSessions(): Promise<void> {
    const sessionIds = this.checkboxStateManager.getCheckedIds()
    await runAction(this.registerManager)?.server.chatSession.deleteSessions({
      actionParams: { sessionIds }
    })
    this.checkboxStateManager.clear()
    this.refresh()
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

  toggleCheckbox(item: ChatHistoriesTreeItem) {
    item.checked = !item.checked
    if (item.checked) {
      this.checkboxStateManager.addCheckedId(item.chatSession.id)
    } else {
      this.checkboxStateManager.removeCheckedId(item.chatSession.id)
    }
    item.updateCheckbox()
    this.refresh(item)
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
              this.checkboxStateManager.isChecked(session.id),
              this
            )
        ) ?? []
    )
  }
}

export class ChatHistoriesTreeRegister extends BaseRegister {
  private treeDataProvider: ChatHistoriesTreeProvider | undefined

  private treeView: vscode.TreeView<ChatHistoriesTreeItem> | undefined

  private checkboxStateManager: CheckboxStateManager

  constructor(
    context: vscode.ExtensionContext,
    registerManager: RegisterManager,
    commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
    this.checkboxStateManager = new CheckboxStateManager()
  }

  register(): void {
    this.treeDataProvider = new ChatHistoriesTreeProvider(
      this.context,
      this.registerManager,
      this.commandManager,
      this.checkboxStateManager
    )

    this.treeView = vscode.window.createTreeView('aide.chatHistoriesTree', {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: false,
      canSelectMany: false
    })

    this.setupCheckboxStateSync()
    this.registerCommands()

    this.context.subscriptions.push(this.treeView)
  }

  private setupCheckboxStateSync(): void {
    this.treeView?.onDidChangeCheckboxState(e => {
      e.items.forEach(([item, state]) => {
        if (state === vscode.TreeItemCheckboxState.Checked) {
          this.checkboxStateManager.addCheckedId(item.chatSession.id)
        } else {
          this.checkboxStateManager.removeCheckedId(item.chatSession.id)
        }
      })
    })
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
        id: 'deleteCheckedSessions',
        handler: () => this.treeDataProvider?.deleteCheckedSessions()
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

class CheckboxStateManager {
  private checkedIds: Set<string> = new Set()

  private onStateChangeCallbacks: ((ids: Set<string>) => void)[] = []

  addCheckedId(id: string): void {
    this.checkedIds.add(id)
    this.notifyStateChange()
  }

  removeCheckedId(id: string): void {
    this.checkedIds.delete(id)
    this.notifyStateChange()
  }

  isChecked(id: string): boolean {
    return this.checkedIds.has(id)
  }

  getCheckedIds(): string[] {
    return Array.from(this.checkedIds)
  }

  clear(): void {
    this.checkedIds.clear()
    this.notifyStateChange()
  }

  onStateChange(callback: (ids: Set<string>) => void): void {
    this.onStateChangeCallbacks.push(callback)
  }

  private notifyStateChange(): void {
    this.onStateChangeCallbacks.forEach(callback => callback(this.checkedIds))
  }
}
