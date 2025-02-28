import { ReloadIcon, StopIcon } from '@radix-ui/react-icons'
import { ButtonWithPromise } from '@webview/components/button-with-promise'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import { useCodeBlockContext } from '@webview/components/chat/messages/markdown/xml-blocks/pre/context/code-block-context'
import { FileIcon } from '@webview/components/file-icon'
import { Button } from '@webview/components/ui/button'
import { CollapsibleBlock } from '@webview/components/ui/collapsible-block'
import { Highlighter } from '@webview/components/ui/highlighter'
import { useConversationContext } from '@webview/contexts/conversation-context'
import { useApplyCode } from '@webview/hooks/chat/use-apply-code'
import { api } from '@webview/network/actions-api'
import { CodeEditTaskState, type FileInfo } from '@webview/types/chat'
import { copyToClipboard } from '@webview/utils/api'
import { getFileNameFromPath } from '@webview/utils/path'
import { CopyIcon, ExternalLinkIcon, PlayIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'

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
  const { t } = useTranslation()

  const copy = async () => {
    await copyToClipboard(processedContent)
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
            tooltip={t('webview.common.open')}
            aria-label={t('webview.codeBlock.openFileInEditor')}
          >
            <ExternalLinkIcon className="size-3" />
          </ButtonWithTooltip>
        </>
      )}
      <ButtonWithPromise
        promiseFn={copy}
        size="iconXs"
        variant="ghost"
        tooltip={t('webview.common.copy')}
        aria-label={t('webview.codeBlock.copyCode')}
      >
        <CopyIcon className="size-3" />
      </ButtonWithPromise>
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
  const { conversation } = useConversationContext()

  const { isApplying, applyStatus, applyCode, cancelApply, reapplyCode } =
    useApplyCode({
      schemeUri: fileInfo?.schemeUri,
      code: fileContent,
      conversationId: conversation.id,
      agentId: uuidv4()
    })
  const { t } = useTranslation()

  const getButtonProps = () => {
    if (isApplying) {
      return {
        onClick: cancelApply,
        icon: <StopIcon className="size-3" />,
        text: t('webview.codeBlock.stopping')
      }
    }
    if (applyStatus === CodeEditTaskState.Accepted) {
      return {
        onClick: () => reapplyCode(),
        icon: <ReloadIcon className="size-3" />,
        text: t('webview.codeBlock.reapply')
      }
    }
    return {
      onClick: () => applyCode(),
      icon: <PlayIcon className="size-3" />,
      text: t('webview.codeBlock.apply')
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
