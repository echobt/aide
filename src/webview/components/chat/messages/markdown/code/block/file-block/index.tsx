import type { FC } from 'react'
import type { FileInfo } from '@extension/file-utils/traverse-fs'
import { InlineDiffTaskState } from '@extension/registers/inline-diff-register/types'
import { ReloadIcon, StopIcon } from '@radix-ui/react-icons'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { FileIcon } from '@webview/components/file-icon'
import { Button } from '@webview/components/ui/button'
import { useApplyCode } from '@webview/hooks/chat/use-apply-code'
import { api } from '@webview/network/actions-api'
import { getFileNameFromPath } from '@webview/utils/path'
import { CopyIcon, ExternalLinkIcon, PlayIcon } from 'lucide-react'
import { toast } from 'sonner'

import { CollapsibleBlock } from '../helpers/collapsible-block'
import { Highlighter } from '../helpers/highlighter'
import type { BaseCodeBlockProps } from '../helpers/types'

export interface FileBlockProps extends Omit<BaseCodeBlockProps, 'content'> {
  language: string
  isLoading?: boolean
  fileContent: string
  fileInfo: FileInfo | null | undefined
}

export const FileBlock: FC<FileBlockProps> = ({
  language,
  fileContent,
  fileInfo,
  defaultExpanded,
  isLoading = false,
  ...rest
}) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(fileContent)
    toast.success('Code copied to clipboard')
  }

  const openFileInEditor = async () => {
    if (!fileInfo?.fullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        path: fileInfo.fullPath
      }
    })
  }

  const ApplyActions = useApplyActions({ fileInfo, fileContent })

  const renderActions = () => (
    <>
      {Boolean(fileInfo?.fullPath) && (
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
    fileInfo?.relativePath ? (
      <div className="flex shrink-0 items-center mr-2">
        <FileIcon className="size-3 mr-1" filePath={fileInfo.relativePath} />
        <span>{getFileNameFromPath(fileInfo.relativePath)}</span>
      </div>
    ) : null

  return (
    <CollapsibleBlock
      {...rest}
      title={renderFileName() || language}
      actions={renderActions()}
      isLoading={isLoading}
      defaultExpanded={defaultExpanded}
    >
      <Highlighter language={language} content={fileContent} />
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
    useApplyCode(fileInfo?.fullPath, fileContent)

  const getButtonProps = () => {
    if (isApplying) {
      return {
        onClick: cancelApply,
        icon: <StopIcon className="size-3" />,
        text: 'Stopping...'
      }
    }
    if (applyStatus === InlineDiffTaskState.Finished) {
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
