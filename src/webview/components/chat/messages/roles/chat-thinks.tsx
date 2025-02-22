import { FC, useEffect, useState, type ReactNode } from 'react'
import { LightningBoltIcon } from '@radix-ui/react-icons'
import type { Conversation } from '@shared/entities'
import { Card } from '@webview/components/ui/card'
import {
  SplitAccordion,
  SplitAccordionContent,
  SplitAccordionTrigger
} from '@webview/components/ui/split-accordion'
import { CustomRenderThinkItem } from '@webview/contexts/plugin-context/use-agent-plugin'
import { cn } from '@webview/utils/common'

import { Markdown } from '../markdown'

export const ChatThinkItem: FC<{
  className?: string
  title: string
  content?: string
  children?: ReactNode
}> = ({ title, content, className, children }) => (
  <Card
    className={cn(
      'relative overflow-hidden bg-muted/50 hover:bg-muted/80 transition-colors',
      className
    )}
  >
    <div className="flex-1 p-2 gap-2">
      <div className="flex items-center">
        <h4 className="font-medium text-md truncate">{title}</h4>
      </div>

      {content && (
        <div
          className={cn(
            'text-sm text-muted-foreground border my-2 p-2 rounded-md'
          )}
        >
          <Markdown
            variant="chat"
            fontSize={12}
            lineHeight={1.5}
            className="prose-sm"
          >
            {content}
          </Markdown>
        </div>
      )}

      {children}
    </div>
  </Card>
)

export const ChatThinks: FC<{
  conversation: Conversation
  isLoading: boolean
}> = ({ conversation, isLoading }) => {
  const { thinkAgents: agents } = conversation
  const [open, setOpen] = useState(false)
  const { isGenerating } = conversation.state

  useEffect(() => {
    setOpen(isGenerating)
  }, [isGenerating])

  if (agents.length === 0) return null

  const getAccordionTriggerTitle = () => {
    if (!isLoading) return 'Thought'

    if (conversation.thinkAgents.length > 0)
      return conversation.thinkAgents.at(-1)?.name || 'Thinking...'

    return 'Thinking...'
  }

  return (
    <SplitAccordion
      value={open ? 'log' : ''}
      onValueChange={value => {
        if (value === 'log') setOpen(true)
        else setOpen(false)
      }}
      className="w-full"
    >
      <SplitAccordionTrigger
        value="log"
        variant="outline"
        size="sm"
        iconClassName="size-3"
        className="border-none"
      >
        <LightningBoltIcon className="size-3" />
        <span className="select-none">{getAccordionTriggerTitle()}</span>
      </SplitAccordionTrigger>
      <SplitAccordionContent value="log" className="mt-2">
        <div className="mt-2 space-y-2">
          {agents.map((agent, index) => (
            <div key={index}>
              {agent ? <CustomRenderThinkItem agent={agent} /> : null}
            </div>
          ))}
        </div>
      </SplitAccordionContent>
    </SplitAccordion>
  )
}
