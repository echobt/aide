import { FC, useMemo } from 'react'
import { defaultPresetFrameworkName } from '@extension/registers/webvm-register/presets/_base/constants'
import { V1ProjectParser } from '@shared/plugins/markdown/parsers/v1-project-parser'
import { getWebPreviewProjectVersion } from '@shared/utils/chat-context-helper/common/web-preview-project'
import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { useBlockOriginalContent } from '@webview/components/chat/messages/markdown/hooks/use-block-original-content'
import { useChatWebPreviewContext } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { useConversationContext } from '@webview/contexts/conversation-context'
import { api } from '@webview/network/actions-api'

import type { BaseCustomElementProps } from '../../types'
import { TimelineCard, type TimelineItem } from './timeline-card'

interface V1ProjectProps
  extends BaseCustomElementProps<{
    id: string
    presetname: string
  }> {}

interface FileOperation {
  title: string
  filePath: string
}

const createFileOperation = (
  action: string,
  filePath: string,
  extraInfo?: string
): FileOperation => ({
  title: extraInfo ? `${action}: ${extraInfo}` : `${action}: ${filePath}`,
  filePath
})

export const V1Project: FC<V1ProjectProps> = ({ node }) => {
  const v1ProjectName = String(node.properties.id || '')
  const originalContent = useBlockOriginalContent(node)
  const { context } = useChatContext()
  const { conversation } = useConversationContext()
  const { defaultPresetName, openPreviewPage } = useChatWebPreviewContext()
  const presetName =
    String(node.properties.presetname || '') || defaultPresetName

  const v1ProjectContents = useMemo(() => {
    const parser = new V1ProjectParser()
    return parser.parseInnerContent(originalContent)
  }, [originalContent])

  const { data: presetInfo } = useQuery({
    queryKey: ['web-preview-preset-info', { presetName }],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getPresetInfo({
        abortController: signalToController(signal),
        actionParams: { presetName }
      }),
    enabled: Boolean(presetName)
  })
  const presetFrameworkName =
    presetInfo?.presetFrameworkName || defaultPresetFrameworkName

  const projectVersion = getWebPreviewProjectVersion(
    context.conversations,
    conversation.id,
    v1ProjectName
  )

  // console.log('v1project', {
  //   projectName: v1ProjectName,
  //   projectVersion,
  //   presetName,
  //   presetFrameworkName,
  //   isBlockClosed
  // })

  const handleOpenProject = () => {
    openPreviewPage({ projectName: v1ProjectName, projectVersion })
  }

  const handleFileOpen = (filePath: string) => {
    if (!filePath) return

    openPreviewPage({
      projectName: v1ProjectName,
      projectVersion,
      tab: 'code',
      activeFilePath: filePath
    })
  }

  const timelineItems = v1ProjectContents
    .map<TimelineItem | null>(content => {
      let operation: FileOperation | null = null

      if (content.type === 'xml') {
        switch (content.tagName) {
          case 'MoveFile': {
            const { fromFilePath, toFilePath } = content.otherInfo
            operation = createFileOperation(
              'Moved',
              toFilePath || '',
              `${fromFilePath} → ${toFilePath}`
            )
            break
          }
          case 'DeleteFile':
            operation = createFileOperation(
              'Deleted',
              content.otherInfo.filePath || ''
            )
            break
          case 'QuickEdit':
            operation = createFileOperation(
              'Modified',
              content.otherInfo.filePath || ''
            )
            break
          default:
            break
        }
      } else if (content.type === 'code') {
        const filePath =
          content.otherInfo?.v1ProjectFilePath ||
          content.otherInfo?.filePath ||
          ''

        if (filePath) operation = createFileOperation('Generated', filePath)
      }

      if (!operation) return null

      return {
        title: operation.title,
        onClick: () => handleFileOpen(operation.filePath)
      }
    })
    .filter((item): item is TimelineItem => item !== null)

  return (
    <TimelineCard
      projectName={v1ProjectName || 'Unknown Project'}
      projectVersion={projectVersion}
      projectPresetFrameworkName={presetFrameworkName}
      items={timelineItems}
      onOpenProject={handleOpenProject}
    />
  )
}
