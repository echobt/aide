import { ChatActionsCollection, useChatActions } from './chat-actions'
import { CommonActionsCollection, useCommonActions } from './common-actions'
import {
  PromptSnippetActionsCollection,
  usePromptSnippetActions
} from './prompt-snippet-action'
import { SettingActionsCollection, useSettingActions } from './setting-actions'

export const clientActionCollections = [
  CommonActionsCollection,
  ChatActionsCollection,
  PromptSnippetActionsCollection,
  SettingActionsCollection
] as const

export type ClientActionCollections = typeof clientActionCollections

export const useGlobalActions = () => {
  useCommonActions()
  useSettingActions()
  useChatActions()
  usePromptSnippetActions()
}
