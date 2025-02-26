import React, { createContext, useContext } from 'react'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'

import { changeLanguage } from '../../shared/localize'
import { Locale } from '../../shared/localize/types'

interface I18nContextType {
  locale: Locale | undefined
  setLocale: (locale: Locale) => Promise<void>
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { invalidateQueries } = useInvalidateQueries()

  const languageQuery = useQuery({
    queryKey: ['language'],
    queryFn: ({ signal }) =>
      api.actions().server.settings.getLanguage({
        abortController: signalToController(signal),
        actionParams: {}
      })
  })
  const currentLocale = languageQuery.data?.currentLocale as Locale | undefined
  const defaultLocale = languageQuery.data?.defaultLocale as Locale | undefined

  const changeLanguageMutation = useMutation({
    mutationFn: (language: Locale) =>
      api.actions().server.settings.changeLanguage({
        actionParams: { language }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['language']
      })
    }
  })

  // Function to change language
  const setLocale = async (newLocale: Locale) => {
    changeLanguageMutation.mutate(newLocale)
    await changeLanguage(newLocale || defaultLocale || '')
  }

  return (
    <I18nContext.Provider
      value={{
        locale: currentLocale || '',
        setLocale
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
