import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import { runAction } from '@extension/state'
import { type PromptSnippet } from '@shared/entities'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import { BaseTreeItem, BaseTreeProvider } from './helpers/tree/base-tree'
import type { TreeActionConfig, TreeItemConfig } from './helpers/tree/types'

// Tree item for prompt snippets
class PromptSnippetTreeItem extends BaseTreeItem {
  constructor(
    public readonly promptSnippet: PromptSnippet,
    actions: TreeActionConfig[],
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    const config: TreeItemConfig = {
      id: 'promptSnippetTreeItem',
      label: promptSnippet.title,
      description: new Date(promptSnippet.updatedAt).toLocaleString(),
      tooltip: promptSnippet.title,
      iconPath: new vscode.ThemeIcon('open-editors-view-icon'),
      collapsibleState,
      clickAction: {
        actionType: 'client',
        actionCategory: 'promptSnippet',
        actionName: 'openPromptSnippetEditPage',
        actionParams: {
          snippetId: promptSnippet.id
        }
      },
      data: promptSnippet
    }

    super(config, actions)
  }
}

class PromptSnippetTreeProvider extends BaseTreeProvider<PromptSnippetTreeItem> {
  constructor(
    context: vscode.ExtensionContext,
    registerManager: RegisterManager,
    commandManager: CommandManager
  ) {
    // Define tree actions
    const actions: TreeActionConfig<PromptSnippetTreeItem>[] = [
      {
        id: 'refresh',
        title: 'Refresh',
        icon: '$(refresh)',
        handler: () => this.refresh()
      },
      {
        id: 'createSnippet',
        title: 'New Snippet',
        icon: '$(plus)',
        handler: () => this.createSnippet()
      },
      {
        id: 'deleteSnippet',
        title: 'Delete',
        icon: '$(trash)',
        showInContextMenu: true,
        handler: item => item && this.deleteSnippet(item.promptSnippet.id)
      },
      {
        id: 'duplicateSnippet',
        title: 'Duplicate',
        icon: '$(copy)',
        showInContextMenu: true,
        handler: item => item && this.duplicateSnippet(item.promptSnippet.id)
      }
    ]

    super(context, registerManager, commandManager, actions)
  }

  getTreeId(): string {
    return 'promptSnippetTree'
  }

  async refresh(item?: PromptSnippetTreeItem | undefined): Promise<void> {
    super.refresh(item)
    await runAction(
      this.registerManager
    )?.client.promptSnippet.refreshPromptSnippets({
      actionParams: {}
    })
  }

  async getChildren(): Promise<PromptSnippetTreeItem[]> {
    const snippets = await runAction(
      this.registerManager
    )?.server.promptSnippet.getSnippets({
      actionParams: {}
    })

    return (
      snippets
        ?.sort((a, b) => b.updatedAt - a.updatedAt)
        ?.map(
          snippet =>
            new PromptSnippetTreeItem(
              snippet,
              this.actions,
              vscode.TreeItemCollapsibleState.None
            )
        ) ?? []
    )
  }

  private async createSnippet(): Promise<void> {
    await runAction(
      this.registerManager
    )?.client.promptSnippet.openPromptSnippetEditPage({
      actionParams: {}
    })
  }

  private async duplicateSnippet(snippetId: string): Promise<void> {
    const snippet = await runAction(
      this.registerManager
    )?.server.promptSnippet.duplicateSnippetById({
      actionParams: { id: snippetId }
    })

    await this.refresh()

    await runAction(
      this.registerManager
    )?.client.promptSnippet.openPromptSnippetEditPage({
      actionParams: {
        snippetId: snippet.id
      }
    })
  }

  private async deleteSnippet(snippetId: string): Promise<void> {
    await runAction(this.registerManager)?.server.promptSnippet.removeSnippet({
      actionParams: { id: snippetId }
    })

    await this.refresh()
  }
}

// Register class for prompt snippet tree
export class PromptSnippetTreeRegister extends BaseRegister {
  private treeDataProvider: PromptSnippetTreeProvider | undefined

  private treeView: vscode.TreeView<PromptSnippetTreeItem> | undefined

  register(): void {
    this.treeDataProvider = new PromptSnippetTreeProvider(
      this.context,
      this.registerManager,
      this.commandManager
    )

    this.treeView = vscode.window.createTreeView('aide.promptSnippetTree', {
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
