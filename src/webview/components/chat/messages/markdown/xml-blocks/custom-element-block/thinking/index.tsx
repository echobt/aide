/* eslint-disable unused-imports/no-unused-vars */
import { FC } from 'react'
import { useBlockOriginalContent } from '@webview/components/chat/messages/markdown/hooks/use-block-original-content'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@webview/components/ui/accordion'

import type { BaseCustomElementProps } from '../../types'

interface ThinkingProps extends BaseCustomElementProps {
  children: React.ReactNode
}

export const Thinking: FC<ThinkingProps> = ({ children, node }) => {
  const originalContent = useBlockOriginalContent(node)

  return (
    <Accordion type="single" collapsible className="w-full my-4">
      <AccordionItem value="thinking">
        <AccordionTrigger>Thinking Process</AccordionTrigger>
        <AccordionContent>{originalContent}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
