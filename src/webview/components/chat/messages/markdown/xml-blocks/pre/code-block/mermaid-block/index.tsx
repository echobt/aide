/* eslint-disable unused-imports/no-unused-vars */
import { useRef } from 'react'
import { CopyIcon } from '@radix-ui/react-icons'
import { ButtonWithPromise } from '@webview/components/button-with-promise'
import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import { useCodeBlockContext } from '@webview/components/chat/messages/markdown/xml-blocks/pre/context/code-block-context'
import { CollapsibleBlock } from '@webview/components/ui/collapsible-block'
import { copyToClipboard } from '@webview/utils/api'
import { useTranslation } from 'react-i18next'

import { useMermaid } from './use-mermaid'

export const MermaidBlock = () => {
  const { codeBlockDefaultExpanded } = useMarkdownContext()
  const { content, elProps } = useCodeBlockContext()
  const containerRef = useRef<HTMLDivElement>(null!)
  const svg = useMermaid(content, containerRef)
  const { t } = useTranslation()

  const copy = async () => {
    await copyToClipboard(content)
  }

  const actions = (
    <ButtonWithPromise
      className="transition-colors"
      promiseFn={copy}
      size="iconXss"
      variant="ghost"
      tooltip={t('webview.mermaid.copyCode')}
      aria-label={t('webview.mermaid.copyCode')}
    >
      <CopyIcon className="size-3" />
    </ButtonWithPromise>
  )

  return (
    <CollapsibleBlock
      title="mermaid"
      actionSlot={actions}
      defaultExpanded={codeBlockDefaultExpanded}
      {...elProps}
    >
      <div
        ref={containerRef}
        className="overflow-auto w-full h-full"
        style={elProps.style}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </CollapsibleBlock>
  )
}
