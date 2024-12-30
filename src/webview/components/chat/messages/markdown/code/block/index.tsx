import type { CSSProperties, FC } from 'react'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { CollapsibleCode } from '@webview/components/collapsible-code'
import { FileIcon } from '@webview/components/file-icon'
import { useFileInfoForMessage } from '@webview/hooks/api/use-file-info-for-message'
import { api } from '@webview/network/actions-api'
import { cn } from '@webview/utils/common'
import { getFileNameFromPath } from '@webview/utils/path'
import { getShikiLanguage } from '@webview/utils/shiki'
import { CopyIcon, ExternalLinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Highlighter, type HighlighterProps } from './highlighter'
import { Mermaid, type MermaidProps } from './mermaid'
import { useApplyActions } from './use-apply-actions'
import { useCode } from './use-code'
import { getRangeFromCode } from './utils'

export interface CodeBlockProps {
  children: string
  fileRelativePath?: string
  className?: string
  style?: React.CSSProperties
  enableMermaid?: boolean
  highlightProps?: HighlighterProps
  mermaidProps?: MermaidProps
  defaultExpanded?: boolean
}

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  fileRelativePath,
  className,
  style,
  enableMermaid,
  highlightProps,
  mermaidProps,
  defaultExpanded = true
}) => {
  const { content, lang } = useCode(
    Array.isArray(children) ? children[0] : children
  )

  const [maybeLanguage, relativePath] = lang.split(':')
  const shikiLang = getShikiLanguage({
    unknownLang: maybeLanguage,
    path: fileRelativePath
  })

  if (!content) return

  // Render Mermaid if enabled and language is mermaid
  if (enableMermaid && lang === 'mermaid') {
    return (
      <Mermaid
        {...mermaidProps}
        className={cn(
          'overflow-hidden my-2',
          className,
          mermaidProps?.className
        )}
        style={{ ...style, ...mermaidProps?.style }}
        defaultExpanded={defaultExpanded}
      >
        {content}
      </Mermaid>
    )
  }

  // Render code with syntax highlighting
  return (
    <HighlighterBlock
      {...highlightProps}
      className={cn(
        'overflow-hidden my-2',
        className,
        highlightProps?.className
      )}
      style={{ ...style, ...highlightProps?.style }}
      fileRelativePath={fileRelativePath || relativePath}
      language={shikiLang}
      defaultExpanded={defaultExpanded}
    >
      {content}
    </HighlighterBlock>
  )
}

export interface HighlighterBlockProps {
  children: string
  language: string
  style?: CSSProperties
  className?: string
  copyable?: boolean
  fileRelativePath?: string
  defaultExpanded?: boolean
  isLoading?: boolean
}

export const HighlighterBlock: FC<HighlighterBlockProps> = ({
  children: code,
  language,
  style,
  className = '',
  copyable = true,
  fileRelativePath,
  defaultExpanded,
  isLoading = false
}) => {
  const { startLine, endLine } = getRangeFromCode(code)
  const { data: fileInfo } = useFileInfoForMessage({
    relativePath: fileRelativePath,
    startLine,
    endLine
  })

  const fileFullPath = fileInfo?.fullPath

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard')
  }

  const openFileInEditor = async () => {
    if (!fileFullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        path: fileFullPath
      }
    })
  }

  const ApplyActions = useApplyActions({ fileFullPath, code })

  const renderActions = () => (
    <>
      {Boolean(fileFullPath) && (
        <>
          {ApplyActions}
          <ButtonWithTooltip
            onClick={openFileInEditor}
            size="iconXs"
            variant="ghost"
            tooltip="Open"
            aria-label="Open file in editor"
          >
            <ExternalLinkIcon className="size-3" />
          </ButtonWithTooltip>
        </>
      )}
      {copyable && (
        <ButtonWithTooltip
          onClick={copyToClipboard}
          size="iconXs"
          variant="ghost"
          tooltip="Copy"
          aria-label="Copy code"
        >
          <CopyIcon className="size-3" />
        </ButtonWithTooltip>
      )}
    </>
  )

  const renderFileName = () =>
    fileRelativePath ? (
      <div className="flex shrink-0 items-center mr-2">
        <FileIcon className="size-3 mr-1" filePath={fileRelativePath} />
        <span>{getFileNameFromPath(fileRelativePath)}</span>
      </div>
    ) : null

  return (
    <CollapsibleCode
      title={renderFileName() || language}
      actions={renderActions()}
      className={className}
      isLoading={isLoading}
      defaultExpanded={defaultExpanded}
    >
      <Highlighter style={style} language={language}>
        {code}
      </Highlighter>
    </CollapsibleCode>
  )
}
