import React, { createContext, useContext, useRef } from 'react'
import { ProviderUtils } from '@shared/plugins/_shared/provider-manager'

import { MentionPluginId } from '../types'
import type { MentionClientPluginProviderMap } from './mention-client-plugin-types'

type ProviderKey = keyof MentionClientPluginProviderMap

type IdProviderMap = Record<
  MentionPluginId,
  () => MentionClientPluginProviderMap[ProviderKey]
>

export interface MentionClientPluginContextValue {
  registerProvider: <K extends ProviderKey>(
    pluginId: MentionPluginId,
    providerKey: K,
    provider: () => MentionClientPluginProviderMap[K]
  ) => void
  getProviders: <K extends ProviderKey>(
    providerKey: K
  ) => MentionClientPluginProviderMap[K][]
  mergeProviders: <K extends ProviderKey>(
    providerKey: K
  ) => MentionClientPluginProviderMap[K] | undefined
}

const MentionClientPluginContext =
  createContext<MentionClientPluginContextValue | null>(null)

export const MentionClientPluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => {
  const providerKeyInfoMapRef = useRef({} as Record<ProviderKey, IdProviderMap>)

  const registerProvider = <K extends keyof MentionClientPluginProviderMap>(
    pluginId: MentionPluginId,
    providerKey: K,
    provider: () => MentionClientPluginProviderMap[K]
  ) => {
    if (!providerKeyInfoMapRef.current[providerKey]) {
      providerKeyInfoMapRef.current[providerKey] = {} as IdProviderMap
    }
    providerKeyInfoMapRef.current[providerKey]![pluginId] = provider
  }

  const getProviders = <K extends keyof MentionClientPluginProviderMap>(
    providerKey: K
  ): MentionClientPluginProviderMap[K][] => {
    const idProviderMap = (providerKeyInfoMapRef.current[providerKey] ||
      {}) as Record<MentionPluginId, () => MentionClientPluginProviderMap[K]>

    return ProviderUtils.getValues(idProviderMap)
  }

  const mergeProviders = <K extends keyof MentionClientPluginProviderMap>(
    providerKey: K
  ): MentionClientPluginProviderMap[K] | undefined => {
    const idProviderMap = (providerKeyInfoMapRef.current[providerKey] ||
      {}) as Record<MentionPluginId, () => MentionClientPluginProviderMap[K]>

    const result = ProviderUtils.mergeAll(idProviderMap)

    return result
  }

  return (
    <MentionClientPluginContext.Provider
      value={{
        registerProvider,
        getProviders,
        mergeProviders
      }}
    >
      {children}
    </MentionClientPluginContext.Provider>
  )
}

export const useMentionPlugin = () => {
  const context = useContext(MentionClientPluginContext)
  if (!context) {
    throw new Error(
      'useMentionPlugin must be used within MentionClientPluginProvider'
    )
  }
  return context
}
