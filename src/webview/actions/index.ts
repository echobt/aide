import { ChatActionsCollection, useChatActions } from './chat-actions'
import { CommonActionsCollection, useCommonActions } from './common-actions'
import { SettingActionsCollection, useSettingActions } from './setting-actions'

export const clientActionCollections = [
  CommonActionsCollection,
  ChatActionsCollection,
  SettingActionsCollection
] as const

export type ClientActionCollections = typeof clientActionCollections

export const useGlobalActions = () => {
  useCommonActions()
  useSettingActions()
  useChatActions()
}
