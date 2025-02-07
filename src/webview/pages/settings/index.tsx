import { useEffect } from 'react'
import { settingsConfig } from '@shared/entities'
import { Settings } from '@webview/components/settings/settings'
import { useQueryState } from 'nuqs'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [pageId] = useQueryState('pageId', {
    parse: (value: string | null) => {
      if (!value) return null
      const isValidPage =
        settingsConfig.pages?.some(p => p.id === value) ||
        settingsConfig.groups.some(group =>
          group.pages.some(p => p.id === value)
        )
      return isValidPage ? value : null
    }
  })

  useEffect(() => {
    if (pageId === null) {
      navigate('/settings', { replace: true })
    }
  }, [pageId, navigate])

  return <Settings initialPageId={pageId ?? undefined} />
}
