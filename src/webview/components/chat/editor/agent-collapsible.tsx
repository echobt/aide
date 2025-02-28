import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon
} from '@radix-ui/react-icons'
import type { Agent, Conversation } from '@shared/entities'
import { Button } from '@webview/components/ui/button'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionAgentContext } from '@webview/contexts/conversation-agent-context/session-agent-context'
import {
  CustomRenderFloatingAgentItem,
  useAgentPluginIsCompletedAgent,
  useAgentPluginIsSameAgent,
  useAgentPluginIsShowInFloatingAgentItem
} from '@webview/contexts/plugin-context/use-agent-plugin'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export interface AgentCollapsibleProps {
  className?: string
}

interface UnCompletedAgentInfo {
  agent: Agent
  agentIndex: number
  conversation: Conversation
  conversationIndex: number
  isCompleted: boolean
}

export const AgentCollapsible: React.FC<AgentCollapsibleProps> = ({
  className = ''
}) => {
  const { t } = useTranslation()
  const { context, setContext } = useChatContext()
  const sessionId = context.id
  const [isExpanded, setIsExpanded] = useState(false)
  const isSameAgent = useAgentPluginIsSameAgent()
  const isCompletedAgent = useAgentPluginIsCompletedAgent()
  const isShowInFloatingAgentItem = useAgentPluginIsShowInFloatingAgentItem()
  const { acceptMultipleAgentsMutation, rejectMultipleAgentsMutation } =
    useSessionAgentContext()
  const uniqAgentInfos = useMemo(() => {
    // Use Map to store unique agents with their conversations
    const agentIdInfoMap = new Map<string, UnCompletedAgentInfo>()

    // Iterate through conversations and their agents
    context.conversations.forEach((conversation, conversationIndex) => {
      conversation.agents?.forEach((agent, agentIndex) => {
        let shouldAdd = true

        if (!isShowInFloatingAgentItem(agent)) return

        // Check against existing agents
        for (const [id, existing] of agentIdInfoMap.entries()) {
          if (isSameAgent(agent, existing.agent)) {
            if ((agent?.weight || 0) > (existing.agent?.weight || 0)) {
              agentIdInfoMap.delete(id)
            } else {
              shouldAdd = false
            }
            break
          }
        }

        if (shouldAdd) {
          agentIdInfoMap.set(agent.id, {
            agent,
            agentIndex,
            conversation,
            conversationIndex,
            isCompleted: isCompletedAgent(agent)
          })
        }
      })
    })

    return Array.from(agentIdInfoMap.values())
  }, [context.conversations, isSameAgent, isShowInFloatingAgentItem])

  // const uniqAgentInfos = useDeferredValue(_uniqAgentInfos, [])

  useEffect(() => {
    if (uniqAgentInfos.length > 0) {
      setIsExpanded(true)
    }
  }, [uniqAgentInfos.length])

  const unCompletedAgentInfos = uniqAgentInfos.filter(
    agent => !agent.isCompleted
  )

  const getUnCompletedAgentInfos = useCallbackRef(() => unCompletedAgentInfos)

  const handleAcceptAll = () => {
    acceptMultipleAgentsMutation.mutate({
      sessionId,
      agentItems: getUnCompletedAgentInfos().map(agentInfo => ({
        conversationId: agentInfo.conversation.id,
        agentId: agentInfo.agent.id
      }))
    })
  }

  const handleRejectAll = () => {
    rejectMultipleAgentsMutation.mutate({
      sessionId,
      agentItems: getUnCompletedAgentInfos().map(agentInfo => ({
        conversationId: agentInfo.conversation.id,
        agentId: agentInfo.agent.id
      }))
    })
  }

  if (!uniqAgentInfos.length) return null

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
            aria-label={
              isExpanded
                ? t('webview.actions.collapseCode')
                : t('webview.actions.expandCode')
            }
          >
            {isExpanded ? (
              <ChevronUpIcon className="size-3" />
            ) : (
              <ChevronDownIcon className="size-3" />
            )}
          </Button>
          <span className="font-medium">
            {t('webview.actions.actionsCount', {
              count: uniqAgentInfos.length
            })}
          </span>
        </div>

        {/* actions */}
        <div className="flex items-center  gap-1">
          {unCompletedAgentInfos.length > 0 && (
            <>
              <Button
                className="transition-colors"
                onClick={handleRejectAll}
                size="xsss"
                variant="ghost"
                aria-label={t('webview.actions.rejectAll')}
              >
                {t('webview.actions.rejectAll')}
                <Cross2Icon className="size-3" />
              </Button>
              <Button
                className="transition-colors"
                onClick={handleAcceptAll}
                size="xsss"
                variant="default"
                aria-label={t('webview.actions.acceptAll')}
              >
                {t('webview.actions.acceptAll')}
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
            {uniqAgentInfos.map(
              ({ agent, conversation, agentIndex, conversationIndex }) => (
                <CustomRenderFloatingAgentItem
                  key={agent.id}
                  agent={agent}
                  setAgent={updater => {
                    setContext(draft => {
                      if (!draft.conversations[conversationIndex]!.agents)
                        draft.conversations[conversationIndex]!.agents = []

                      if (typeof updater === 'function') {
                        updater(
                          draft.conversations[conversationIndex]!.agents[
                            agentIndex
                          ]!
                        )
                      } else {
                        draft.conversations[conversationIndex]!.agents[
                          agentIndex
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
