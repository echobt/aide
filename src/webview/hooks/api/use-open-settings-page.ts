import { api } from '@webview/network/actions-api'
import { getWebviewState } from '@webview/utils/common'
import { useNavigate } from 'react-router'

import { useBreakpoint } from '../use-breakpoint'

interface OpenSettingsPageProps {
  pageId?: string
  replace?: boolean
}

export const useOpenSettingsPage = () => {
  const isMd = useBreakpoint('md')
  const navigate = useNavigate()

  const openSettingsPage = async (props?: OpenSettingsPageProps) => {
    const { pageId, replace = false } = props || {}
    const { isSidebarWebview } = getWebviewState()
    const shouldOpenInBigWebview = !isMd && isSidebarWebview

    const baseRoutePath = '/settings'
    const searchParams = new URLSearchParams()
    if (pageId) {
      searchParams.set('pageId', pageId)
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

  return { openSettingsPage }
}
