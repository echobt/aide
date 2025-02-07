import { useState, type FC } from 'react'
import { useGetFullPath } from '@webview/hooks/api/use-get-full-path'
import { api } from '@webview/network/actions-api'
import { useDebounce } from 'react-use'

import { getContentInfoFromChildren } from '../block/helpers/utils'

export interface InlineCodeProps extends React.ComponentProps<'code'> {
  children?: React.ReactNode
}

export const InlineCode: FC<InlineCodeProps> = ({ children, ...rest }) => {
  const { content: originalContent } = getContentInfoFromChildren(children)
  const [content, setContent] = useState(originalContent)

  useDebounce(
    () => {
      setContent(originalContent)
    },
    1000,
    [originalContent]
  )

  const { data: fullPath } = useGetFullPath({
    schemeUri: content,
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
