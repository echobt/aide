import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import * as vscode from 'vscode'

import type { TreeActionConfig, TreeItemConfig } from './types'

// Base tree item class
export class BaseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly config: TreeItemConfig,
    private readonly actions: TreeActionConfig[]
  ) {
    super(
      {
        label: config.label,
        highlights: []
      },
      config.collapsibleState
    )

    // Set basic properties
    if (config.description) {
      this.description = config.description
    }

    if (config.tooltip) {
      this.tooltip = config.tooltip
    }

    if (config.iconPath) {
      this.iconPath = config.iconPath
    }

    // Auto generate contextValue from actions
    this.contextValue = this.generateContextValue()

    // Set click action if configured
    if (config.clickAction) {
      this.command = {
        command: 'aide.action',
        title: config.label,
        arguments: [config.clickAction]
      }
    }
  }

  // Generate contextValue from actions configuration
  private generateContextValue(): string {
    const contextValues = [
      // Base context value
      this.config.id,
      // Action context values
      ...this.actions
        .filter(action => action.showInContextMenu)
        .map(action => `action:${action.id}`)
    ]
    return contextValues.join(',')
  }
}

// Base tree provider class
export abstract class BaseTreeProvider<T extends BaseTreeItem>
  implements vscode.TreeDataProvider<T>
{
  protected _onDidChangeTreeData: vscode.EventEmitter<
    T | undefined | null | void
  > = new vscode.EventEmitter<T | undefined | null | void>()

  readonly onDidChangeTreeData: vscode.Event<T | undefined | null | void> =
    this._onDidChangeTreeData.event

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager,
    protected actions: TreeActionConfig<T>[]
  ) {
    this.registerTreeCommands()
  }

  // Register commands for all actions
  private registerTreeCommands(): void {
    const disposables = this.actions.map(action =>
      vscode.commands.registerCommand(
        `aide.${this.getTreeId()}.${action.id}`,
        (item?: T) => action.handler(item)
      )
    )

    this.context.subscriptions.push(...disposables)
  }

  // Get tree identifier
  abstract getTreeId(): string

  // Refresh tree view
  refresh(item?: T): void | Promise<void> {
    this._onDidChangeTreeData.fire(item)
  }

  // Get tree item
  getTreeItem(element: T): vscode.TreeItem {
    return element
  }

  // Get children items
  abstract getChildren(element?: T): Thenable<T[]>
}
