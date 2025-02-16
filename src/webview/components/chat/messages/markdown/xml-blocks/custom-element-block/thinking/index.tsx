/* eslint-disable unused-imports/no-unused-vars */
import { FC } from 'react'
import { LightningBoltIcon } from '@radix-ui/react-icons'
import { useBlockOriginalContent } from '@webview/components/chat/messages/markdown/hooks/use-block-original-content'
import {
  SplitAccordion,
  SplitAccordionContent,
  SplitAccordionTrigger
} from '@webview/components/ui/split-accordion'

import type { BaseCustomElementProps } from '../../types'

interface ThinkingProps extends BaseCustomElementProps {
  children: React.ReactNode
}

export const Thinking: FC<ThinkingProps> = ({ children, node }) => {
  const originalContent = useBlockOriginalContent(node)
  const isBlockClosed = node.properties.isblockclosed === 'true'

  return (
    <SplitAccordion defaultValue="thinking">
      <SplitAccordionTrigger
        value="thinking"
        variant="outline"
        size="sm"
        iconClassName="size-3"
        className="border-none"
      >
        <LightningBoltIcon className="size-3" />
        <span className="select-none">
          {isBlockClosed ? 'Thought' : 'Thinking...'}
        </span>
      </SplitAccordionTrigger>
      <SplitAccordionContent value="thinking" className="mt-2">
        <div className="mt-2">{originalContent}</div>
      </SplitAccordionContent>
    </SplitAccordion>
  )
}
