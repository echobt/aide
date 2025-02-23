import type { FC } from 'react'
import type { Conversation } from '@shared/entities'
import type { MentionItemLayoutProps } from '@webview/components/chat/selectors/mention-selector/mention-item-layout'

export type { ProgressInfo } from '@extension/chat/utils/progress-reporter'
export type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
export {
  CodeEditTaskState,
  type CodeEditTaskJson
} from '@extension/registers/code-edit-register/types'
export { defaultPresetFrameworkName } from '@extension/registers/webvm-register/presets/_base/constants'
export type { WebVMPresetInfo } from '@extension/actions/webvm-actions'
export type { PromptSnippetWithSaveType } from '@extension/actions/prompt-snippet-actions'
export type {
  MultipleSessionActionParams,
  SingleSessionActionParams
} from '@extension/actions/agent-actions'
export type { WebviewState } from '@extension/registers/webview-register/types'
export { UriScheme } from '@extension/file-utils/vfs/helpers/types'
export type { MCPConnectionStatus } from '@extension/registers/mcp-register/mcp-connection-manager'

export interface ModelOption {
  value: string
  label: string
}

export enum SearchSortStrategy {
  Default = 'Default',
  EndMatch = 'EndMatch'
}

export interface MentionOption<T = any> {
  id: string
  label: string
  labelForInsertEditor?: string // if not provided, it will use the label
  type?: string
  onSelect?: (data: T) => void
  topLevelSort?: number // if less than 0 or undefined, it will hide in the mention selector
  searchKeywords?: string[]
  searchSortStrategy?: SearchSortStrategy
  children?: MentionOption[]
  data?: T
  disableAddToEditor?: boolean
  itemLayoutProps?: MentionItemLayoutProps
  customRenderItem?: FC<MentionOption>
  customRenderPreview?: FC<MentionOption>
}

export interface ConversationUIState {
  isEditMode?: boolean
  isLoading?: boolean
  sendButtonDisabled?: boolean
}

export interface ConversationWithUIState extends Conversation {
  uiState: ConversationUIState
}
