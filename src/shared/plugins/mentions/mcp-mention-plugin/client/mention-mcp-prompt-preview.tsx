import type { ListPromptsResult } from '@modelcontextprotocol/sdk/types.js'
import { ContentPreview } from '@webview/components/content-preview'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import type { MentionOption } from '@webview/types/chat'

export const MentionMcpPromptPreview: React.FC<
  MentionOption<ListPromptsResult['prompts'][number]>
> = mentionOption => {
  const promptInfo = mentionOption.data

  if (!promptInfo) return null
  const { name, description, inputSchema } = promptInfo

  return (
    <div className="w-full h-[50vh] flex flex-col">
      <div className="flex-1">
        <ScrollArea className="h-full rounded-md">
          <ContentPreview
            content={{
              type: 'markdown',
              content: `
# ${name}

## Description

${description}

## Parameters

\`\`\`json
${JSON.stringify(inputSchema, null, 2)}
\`\`\`
`
            }}
          />
        </ScrollArea>
      </div>
    </div>
  )
}
