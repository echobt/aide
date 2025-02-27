import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js'
import { ContentPreview } from '@webview/components/content-preview'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import type { MentionOption } from '@webview/types/chat'
import { useTranslation } from 'react-i18next'

export const MentionMcpToolPreview: React.FC<
  MentionOption<ListToolsResult['tools'][number]>
> = mentionOption => {
  const toolInfo = mentionOption.data
  const { t } = useTranslation()

  if (!toolInfo) return null
  const { name, description, inputSchema } = toolInfo

  return (
    <div className="w-full h-[50vh] flex flex-col">
      <div className="flex-1">
        <ScrollArea className="h-full rounded-md">
          <ContentPreview
            content={{
              type: 'markdown',
              content: `
# ${name}

## ${t('shared.plugins.mentions.mcp.description')}

${description}

## ${t('shared.plugins.mentions.mcp.parameters')}

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
