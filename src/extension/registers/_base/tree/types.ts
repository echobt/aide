import type { AllActionsConfigs } from '@shared/actions/types'
import type * as vscode from 'vscode'

// Define tree action configuration
export interface TreeActionConfig<T = any> {
  // Action identifier
  id: string
  // Display title
  title: string
  // Icon for command
  icon?: string
  // Handler function
  handler: (item?: T) => Promise<void> | void
  // When clause for menu visibility
  when?: string
  // Whether this action should appear in item's context menu
  showInContextMenu?: boolean
}

// Define tree item configuration
export interface TreeItemConfig<T = any> {
  // Unique identifier
  id: string
  // Display label
  label: string
  // Description text
  description?: string
  // Tooltip text
  tooltip?: string
  // Icon path
  iconPath?: vscode.ThemeIcon | string
  // Collapsible state
  collapsibleState: vscode.TreeItemCollapsibleState
  // Click action configuration
  clickAction?: AllActionsConfigs['context']
  // Custom data
  data?: T
}
