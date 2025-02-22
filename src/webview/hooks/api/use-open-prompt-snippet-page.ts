import { api } from '@webview/network/actions-api'
import { getWebviewState } from '@webview/utils/common'
import { useNavigate } from 'react-router'

import { useBreakpoint } from '../use-breakpoint'

interface OpenPromptSnippetEditPageProps {
  mode?: 'add' | 'edit'
  snippetId?: string
  replace?: boolean
}

export const useOpenPromptSnippetPage = () => {
  const isMd = useBreakpoint('md')
  const navigate = useNavigate()

  const openPromptSnippetEditPage = async (
    props?: OpenPromptSnippetEditPageProps
  ) => {
    const { mode = 'add', snippetId, replace = false } = props || {}
    const { isSidebarWebview } = getWebviewState()
    const shouldOpenInBigWebview = !isMd && isSidebarWebview

    const baseRoutePath = '/prompt-snippet/edit'
    const searchParams = new URLSearchParams()
    searchParams.set('mode', mode)
    if (snippetId) {
      searchParams.set('snippetId', snippetId)
    }

    const routePath = `${baseRoutePath}?${searchParams.toString()}`

    if (shouldOpenInBigWebview) {
      await api.actions().server.settings.openSettingsWebview({
        actionParams: {
          routePath,
          replace
        }
      })
    } else {
      navigate(routePath, { replace })
    }
  }

  return { openPromptSnippetEditPage }
}
