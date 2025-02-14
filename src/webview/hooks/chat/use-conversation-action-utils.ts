import type { Conversation, ConversationAction } from '@shared/entities'
import {
  addOrUpdateActions as addOrUpdateActionsBase,
  type ActionPatchInput
} from '@shared/utils/chat-context-helper/common/action-utils'
import { useChatContext } from '@webview/contexts/chat-context'
import { useAgentPluginIsSameAction } from '@webview/contexts/plugin-context/use-agent-plugin'
import type { Updater } from 'use-immer'

export interface UseConversationActionUtilsProps {
  conversation: Conversation
  setConversation: Updater<Conversation>
}

type AddOrUpdateActionFn<T extends ConversationAction = ConversationAction> = (
  props: ActionPatchInput<T>
) => Promise<void>

type AddOrUpdateActionsFn<
  InputActions extends ActionPatchInput[] = ActionPatchInput[]
> = (props: InputActions) => Promise<void>

export const useConversationActionUtils = ({
  conversation,
  setConversation
}: UseConversationActionUtilsProps) => {
  const isSameAction = useAgentPluginIsSameAction()
  const { saveSession } = useChatContext()

  const addOrUpdateAction: AddOrUpdateActionFn = async ({
    action,
    relatedConversationContent,
    onApplySuccess
  }) => {
    if (!conversation || !setConversation) {
      throw new Error(
        'useConversationActionUtils: Please provide conversation and setConversation'
      )
    }

    const result = addOrUpdateActionsBase({
      conversation,
      setConversation,
      isSameAction,
      inputActions: [
        {
          action,
          relatedConversationContent,
          onApplySuccess
        }
      ]
    })

    await saveSession(false)
    await result.runSuccessEvents()
  }

  const addOrUpdateActions: AddOrUpdateActionsFn = async inputActions => {
    if (!conversation || !setConversation) {
      throw new Error(
        'useConversationActionUtils: Please provide conversation and setConversation'
      )
    }

    const result = addOrUpdateActionsBase({
      conversation,
      setConversation,
      isSameAction,
      inputActions
    })

    await saveSession(false)
    await result.runSuccessEvents()
  }

  return {
    addOrUpdateAction,
    addOrUpdateActions
  }
}
