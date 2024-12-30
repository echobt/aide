import type { FC } from 'react'
import { useGetFullPath } from '@webview/hooks/api/use-get-full-path'
import { api } from '@webview/network/actions-api'

export interface InlineCodeProps {
  className?: string
  style?: React.CSSProperties
  children: any
}

export const InlineCode: FC<InlineCodeProps> = ({ children, ...rest }) => {
  const code: string = (Array.isArray(children) ? children[0] : children) || ''

  const { data: fullPath } = useGetFullPath({
    path: code,
    returnNullIfNotExists: true
  })

  const openFileInEditor = async () => {
    if (!fullPath) return
    await api.actions().server.file.openFileInEditor({
      actionParams: { path: fullPath }
    })
  }

  return (
    <code
      style={{ cursor: fullPath ? 'pointer' : 'text' }}
      onClick={openFileInEditor}
      {...rest}
    >
      {code}
    </code>
  )
}
