import { type FC } from 'react'
import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import { useGetFullPath } from '@webview/hooks/api/use-get-full-path'
import { api } from '@webview/network/actions-api'

export interface InlineCodeBlockProps
  extends Omit<React.ComponentProps<'code'>, 'children'> {
  content: string
}

export const InlineCodeBlock: FC<InlineCodeBlockProps> = ({
  content,
  ...rest
}) => {
  const { isContentGenerating } = useMarkdownContext()
  const { data: fullPath } = useGetFullPath({
    schemeUri: isContentGenerating ? '' : content,
    returnNullIfNotExists: true
  })

  const openFileInEditor = async () => {
    if (!fullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: { schemeUri: fullPath }
    })
  }

  return (
    <code
      {...rest}
      style={{
        ...rest.style,
        cursor: fullPath ? 'pointer' : 'text'
      }}
      onClick={openFileInEditor}
    >
      {content}
    </code>
  )
}
