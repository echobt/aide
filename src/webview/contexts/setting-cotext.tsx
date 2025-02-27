import React, { createContext, FC, useContext, useEffect, useRef } from 'react'
import type { SettingKey, SettingValue } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { useImmer } from 'use-immer'

type SettingStatus = 'idle' | 'saving' | 'success' | 'error'

interface SettingState {
  status: SettingStatus
  value: any
}

type SettingContextValue = {
  getSetting: <K extends SettingKey>(key: K) => SettingValue<K>
  setSetting: <K extends SettingKey>(
    key: K,
    value: SettingValue<K>
  ) => Promise<void>
  getSettingState: <K extends SettingKey>(key: K) => SettingState
}

const SettingContext = createContext<SettingContextValue | null>(null)

export const useSettingContext = () => {
  const context = useContext(SettingContext)
  if (!context) {
    throw new Error(
      'useSettingContext must be used within a SettingContextProvider'
    )
  }
  return context
}

export const SettingContextProvider: FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const { t } = useTranslation()
  const { invalidateQueries } = useInvalidateQueries()
  const [settingStates, setSettingStates] = useImmer<
    Record<SettingKey, SettingState>
  >({} as Record<SettingKey, SettingState>)

  // Use a ref to store timeouts for each setting
  const timeoutRefs = useRef<Record<SettingKey, NodeJS.Timeout>>(
    {} as Record<SettingKey, NodeJS.Timeout>
  )

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) =>
      api.actions().server.settings.getMergedSettings({
        abortController: signalToController(signal),
        actionParams: {}
      })
  })

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      api.actions().server.settings.setSettings({
        actionParams: { settings: { [key]: value } }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['settings']
      })
    }
  })

  const getSetting = <K extends SettingKey>(key: K): SettingValue<K> =>
    settings[key]

  const setSetting = async <K extends SettingKey>(
    key: K,
    value: SettingValue<K>
  ): Promise<void> => {
    if (value === settings[key]) return

    // Clear any existing timeout for this setting
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key])
    }

    setSettingStates(draft => {
      draft[key] = { status: 'saving', value }
    })

    try {
      await updateSettingMutation.mutateAsync({ key, value })
      setSettingStates(draft => {
        draft[key] = { status: 'success', value }
      })

      // Set new timeout and store the reference
      timeoutRefs.current[key] = setTimeout(() => {
        setSettingStates(draft => {
          if (draft[key]) {
            draft[key].status = 'idle'
          }
        })
        delete timeoutRefs.current[key]
      }, 2000)
    } catch (error) {
      setSettingStates(draft => {
        draft[key] = { status: 'error', value }
      })
      logAndToastError(t('webview.settings.failedToUpdate'), error)
      throw error
    }
  }

  const getSettingState = <K extends SettingKey>(key: K): SettingState =>
    settingStates[key] || { status: 'idle', value: settings[key] }

  // Clean up all timeouts and reset non-saving states when component unmounts
  useEffect(
    () => () => {
      // Clear all timeouts
      Object.values(timeoutRefs.current).forEach(timeout => {
        clearTimeout(timeout)
      })
      timeoutRefs.current = {} as Record<SettingKey, NodeJS.Timeout>

      // Reset all non-saving states to idle
      setSettingStates(draft => {
        Object.keys(draft).forEach(key => {
          if (draft[key as SettingKey].status !== 'saving') {
            draft[key as SettingKey].status = 'idle'
          }
        })
      })
    },
    []
  )

  return (
    <SettingContext.Provider
      value={{
        getSetting,
        setSetting,
        getSettingState
      }}
    >
      {children}
    </SettingContext.Provider>
  )
}
