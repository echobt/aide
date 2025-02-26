import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@webview/components/ui/card'
import { Separator } from '@webview/components/ui/separator'
import { useTranslation } from 'react-i18next'

import { LanguageSelector } from './language-selector'
import { ThemeSelector } from './theme-selector'

/**
 * Appearance Settings Section
 * Combines theme and language settings in one place
 */
export const AppearanceSettings = () => {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t('settings.appearance.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.appearance.description')}
        </p>
      </div>

      <Separator />

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance.theme.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('settings.appearance.theme.description')}
            </p>
            <ThemeSelector />
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance.language.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('settings.appearance.language.description')}
            </p>
            <LanguageSelector />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
