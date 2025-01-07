import type { FC } from 'react'
import type { GetAgent } from '@extension/chat/strategies/base'
import type { FileInfo } from '@extension/file-utils/traverse-fs'
import type { CustomRenderThinkItemProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { CodebaseSearchAgent } from '@shared/plugins/agents/codebase-search-agent-plugin/server/codebase-search-agent'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'
import { FileIcon } from '@webview/components/file-icon'
import { TruncateStart } from '@webview/components/truncate-start'
import { api } from '@webview/network/actions-api'
import { cn } from '@webview/utils/common'
import { getFileNameFromPath } from '@webview/utils/path'

import type { CodeSnippet } from '../types'

export const CodebaseSearchAgentThinkItem: SFC<
  CustomRenderThinkItemProps<GetAgent<CodebaseSearchAgent>>
> = ({ agent }) => (
  <ChatThinkItem title="Search Codebase">
    <div className="mt-2 space-y-1.5">
      {agent.output.codeSnippets?.map((snippet, index) => (
        <FileSnippetItem key={index} file={snippet} />
      ))}
    </div>
  </ChatThinkItem>
)

interface FileSnippetItemProps {
  file: CodeSnippet | FileInfo
}

export const FileSnippetItem: FC<FileSnippetItemProps> = ({ file }) => {
  const openFileInEditor = async () => {
    const fileFullPath = file.fullPath

    if (!fileFullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: {
        path: fileFullPath,
        startLine: 'startLine' in file ? file.startLine : undefined
      }
    })
  }

  const fileName = getFileNameFromPath(file.relativePath)

  return (
    <div
      className={cn(
        'w-full cursor-pointer rounded-md text-sm flex items-center gap-2 hover:bg-border select-none'
      )}
      onClick={openFileInEditor}
    >
      <div className="flex flex-shrink-0 items-center gap-2">
        <FileIcon className="size-4" filePath={file.fullPath} />
        <span>{fileName}</span>
      </div>
      <TruncateStart className="text-muted-foreground">
        {file.relativePath}
      </TruncateStart>
    </div>
  )
}
