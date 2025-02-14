import React, { useMemo, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon
} from '@radix-ui/react-icons'
import type { Conversation, ConversationAction } from '@shared/entities'
import { Button } from '@webview/components/ui/button'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionActionContext } from '@webview/contexts/conversation-action-context/session-action-context'
import {
  CustomRenderFloatingActionItem,
  useAgentPluginIsCompletedAction,
  useAgentPluginIsSameAction,
  useAgentPluginIsShowInFloatingActionItem
} from '@webview/contexts/plugin-context/use-agent-plugin'
import { AnimatePresence, motion } from 'framer-motion'

export interface ActionCollapsibleProps {
  defaultExpanded?: boolean
  className?: string
}

export const ActionCollapsible: React.FC<ActionCollapsibleProps> = ({
  defaultExpanded = false,
  className = ''
}) => {
  const { context, setContext } = useChatContext()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const isSameAction = useAgentPluginIsSameAction()
  const isCompletedAction = useAgentPluginIsCompletedAction()
  const isShowInFloatingActionItem = useAgentPluginIsShowInFloatingActionItem()
  const { acceptMultipleActionsMutation, rejectMultipleActionsMutation } =
    useSessionActionContext()
  const uniqActionInfos = useMemo(() => {
    // Use Map to store unique actions with their conversations
    const actionMap = new Map<
      string,
      {
        action: ConversationAction
        actionIndex: number
        conversation: Conversation
        conversationIndex: number
        isCompleted: boolean
      }
    >()

    // Iterate through conversations and their actions
    context.conversations.forEach((conversation, conversationIndex) => {
      conversation.actions.forEach((action, actionIndex) => {
        let shouldAdd = true

        if (!isShowInFloatingActionItem(action)) return

        // Check against existing actions
        for (const [id, existing] of actionMap.entries()) {
          if (isSameAction(action, existing.action)) {
            if (action.weight > existing.action.weight) {
              actionMap.delete(id)
            } else {
              shouldAdd = false
            }
            break
          }
        }

        if (shouldAdd) {
          actionMap.set(action.id, {
            action,
            actionIndex,
            conversation,
            conversationIndex,
            isCompleted: isCompletedAction(action)
          })
        }
      })
    })

    return Array.from(actionMap.values())
  }, [context.conversations, isSameAction, isShowInFloatingActionItem])

  const unCompletedActionInfos = uniqActionInfos.filter(
    action => !action.isCompleted
  )

  const handleAcceptAll = () => {
    acceptMultipleActionsMutation.mutate({
      chatContext: context,
      actionItems: unCompletedActionInfos.map(actionInfo => ({
        conversation: actionInfo.conversation,
        action: actionInfo.action
      }))
    })
  }

  const handleRejectAll = () => {
    rejectMultipleActionsMutation.mutate({
      chatContext: context,
      actionItems: unCompletedActionInfos.map(actionInfo => ({
        conversation: actionInfo.conversation,
        action: actionInfo.action
      }))
    })
  }

  if (!uniqActionInfos.length) return null

  return (
    <div
      className={`relative overflow-hidden rounded-tl-xl rounded-tr-xl border border-b-0 bg-background ${className}`}
    >
      <div className="h-7 flex items-center justify-between px-1 text-xs">
        {/* title */}
        <div
          className="flex h-full items-center flex-1 gap-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Button
            className="transition-colors"
            size="iconXss"
            variant="ghost"
            aria-label={isExpanded ? 'Collapse code' : 'Expand code'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="size-3" />
            ) : (
              <ChevronDownIcon className="size-3" />
            )}
          </Button>
          <span className="font-medium">
            Actions ({uniqActionInfos.length})
          </span>
        </div>

        {/* actions */}
        <div className="flex items-center  gap-1">
          {unCompletedActionInfos.length > 0 && (
            <>
              <Button
                className="transition-colors"
                onClick={handleRejectAll}
                size="xsss"
                variant="ghost"
                aria-label="Reject all"
              >
                Reject all
                <Cross2Icon className="size-3" />
              </Button>
              <Button
                className="transition-colors"
                onClick={handleAcceptAll}
                size="xsss"
                variant="default"
                aria-label="Accept all"
              >
                Accept all
                <CheckIcon className="size-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        <motion.div
          initial="collapsed"
          animate={isExpanded ? 'expanded' : 'collapsed'}
          exit="collapsed"
          variants={{
            expanded: { opacity: 1, height: 'auto' },
            collapsed: { opacity: 0, height: 0 }
          }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-x-hidden overflow-y-auto max-h-[150px]"
          style={{ willChange: 'auto' }}
        >
          <div className="text-xs px-2 py-1">
            {uniqActionInfos.map(
              ({ action, conversation, actionIndex, conversationIndex }) => (
                <CustomRenderFloatingActionItem
                  key={action.id}
                  conversationAction={action}
                  setConversationAction={updater => {
                    setContext(draft => {
                      if (typeof updater === 'function') {
                        updater(
                          draft.conversations[conversationIndex]!.actions[
                            actionIndex
                          ]!
                        )
                      } else {
                        draft.conversations[conversationIndex]!.actions[
                          actionIndex
                        ] = updater
                      }
                    })
                  }}
                  conversation={conversation}
                  setConversation={updater => {
                    setContext(draft => {
                      if (typeof updater === 'function') {
                        updater(draft.conversations[conversationIndex]!)
                      } else {
                        draft.conversations[conversationIndex] = updater
                      }
                    })
                  }}
                />
              )
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
