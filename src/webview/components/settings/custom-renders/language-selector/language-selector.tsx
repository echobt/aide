import React from 'react'
import { Locale } from '@shared/localize/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { useI18n } from '@webview/contexts/i18n-context'
import { useTranslation } from 'react-i18next'

const Default = 'default' as const
type LocaleWithDefault = Locale | typeof Default

export const LanguageSelector = () => {
  const { locale, setLocale } = useI18n()
  const { t } = useTranslation()

  // Available languages
  const availableLanguages: { value: LocaleWithDefault; label: string }[] = [
    { value: Default, label: 'Follow VSCode' },
    { value: 'en', label: 'English' },
    { value: 'zh-cn', label: '中文 (简体)' }
  ]

  // Handle language change
  const handleLanguageChange = async (value: LocaleWithDefault) => {
    // Update local context
    await setLocale(value === Default ? '' : value)
  }

  // Get language display name
  const getLanguageLabel = (value: LocaleWithDefault): string => {
    if (value === Default) {
      return 'Follow VSCode'
    }
    const language = availableLanguages.find(lang => lang.value === value)
    return language?.label || value
  }

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('settings.language.selectPlaceholder')}>
          {getLanguageLabel(locale || Default)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Available languages */}
        {availableLanguages.map(language => (
          <SelectItem key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
