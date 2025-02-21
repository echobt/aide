import { ReloadIcon, StopIcon } from '@radix-ui/react-icons'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import { useCodeBlockContext } from '@webview/components/chat/messages/markdown/xml-blocks/pre/context/code-block-context'
import { FileIcon } from '@webview/components/file-icon'
import { Button } from '@webview/components/ui/button'
import { CollapsibleBlock } from '@webview/components/ui/collapsible-block'
import { Highlighter } from '@webview/components/ui/highlighter'
import { useApplyCode } from '@webview/hooks/chat/use-apply-code'
import { api } from '@webview/network/actions-api'
import { CodeEditTaskState, type FileInfo } from '@webview/types/chat'
import { getFileNameFromPath } from '@webview/utils/path'
import { CopyIcon, ExternalLinkIcon, PlayIcon } from 'lucide-react'
import { toast } from 'sonner'

export const FileBlock = () => {
  const { codeBlockDefaultExpanded } = useMarkdownContext()
  const {
    isLoading,
    shikiLang,
    fileInfo,
    processedContent,
    elProps,
    filePathForDisplay
  } = useCodeBlockContext()

  const copyToClipboard = () => {
    navigator.clipboard.writeText(processedContent)
    toast.success('Code copied to clipboard')
  }

  const openFileInEditor = async () => {
    if (!fileInfo?.schemeUri) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        schemeUri: fileInfo.schemeUri
      }
    })
  }

  const ApplyActions = useApplyActions({
    fileInfo,
    fileContent: processedContent
  })

  const renderActions = () => (
    <>
      {Boolean(fileInfo?.schemeUri) && (
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
      <ButtonWithTooltip
        onClick={copyToClipboard}
        size="iconXs"
        variant="ghost"
        tooltip="Copy"
        aria-label="Copy code"
      >
        <CopyIcon className="size-3" />
      </ButtonWithTooltip>
    </>
  )

  const renderFileName = () =>
    fileInfo?.schemeUri ? (
      <div className="flex shrink-0 items-center mr-2">
        <FileIcon className="size-3 mr-1" filePath={filePathForDisplay} />
        <span>{getFileNameFromPath(filePathForDisplay)}</span>
      </div>
    ) : null

  return (
    <CollapsibleBlock
      {...elProps}
      title={renderFileName() || shikiLang}
      actionSlot={renderActions()}
      status={isLoading ? 'loading' : 'idle'}
      defaultExpanded={codeBlockDefaultExpanded}
    >
      <Highlighter language={shikiLang} content={processedContent} />
    </CollapsibleBlock>
  )
}

export interface UseApplyActionsProps {
  fileInfo: FileInfo | null | undefined
  fileContent: string
}

export const useApplyActions = ({
  fileInfo,
  fileContent
}: UseApplyActionsProps) => {
  const { isApplying, applyStatus, applyCode, cancelApply, reapplyCode } =
    useApplyCode(fileInfo?.schemeUri, fileContent)

  const getButtonProps = () => {
    if (isApplying) {
      return {
        onClick: cancelApply,
        icon: <StopIcon className="size-3" />,
        text: 'Stopping...'
      }
    }
    if (applyStatus === CodeEditTaskState.Accepted) {
      return {
        onClick: () => reapplyCode(),
        icon: <ReloadIcon className="size-3" />,
        text: 'Reapply'
      }
    }
    return {
      onClick: () => applyCode(),
      icon: <PlayIcon className="size-3" />,
      text: 'Apply'
    }
  }

  const { onClick, icon, text } = getButtonProps()

  return (
    <Button
      onClick={onClick}
      size="xs"
      variant="ghost"
      aria-label={text}
      disabled={isApplying}
    >
      {icon}
      <span>{text}</span>
    </Button>
  )
}
