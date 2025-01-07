import React, { createContext, useContext, useRef } from 'react'
import { ProviderUtils } from '@shared/plugins/_shared/provider-manager'

import type { AgentPluginId } from '../types'
import type { AgentClientPluginProviderMap } from './agent-client-plugin-types'

type ProviderKey = keyof AgentClientPluginProviderMap

type IdProviderMap = Record<
  AgentPluginId,
  () => AgentClientPluginProviderMap[ProviderKey]
>

export interface AgentClientPluginContextValue {
  registerProvider: <K extends ProviderKey>(
    pluginId: AgentPluginId,
    providerKey: K,
    provider: () => AgentClientPluginProviderMap[K]
  ) => void
  getProviders: <K extends ProviderKey>(
    providerKey: K
  ) => AgentClientPluginProviderMap[K][]
  getIdProviderMap: <K extends ProviderKey>(
    providerKey: K
  ) => Record<AgentPluginId, AgentClientPluginProviderMap[K]>
  mergeProviders: <K extends ProviderKey>(
    providerKey: K
  ) => AgentClientPluginProviderMap[K] | undefined
}

const AgentClientPluginContext =
  createContext<AgentClientPluginContextValue | null>(null)

export const AgentClientPluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => {
  const providerKeyInfoMapRef = useRef({} as Record<ProviderKey, IdProviderMap>)

  const registerProvider = <K extends keyof AgentClientPluginProviderMap>(
    pluginId: AgentPluginId,
    providerKey: K,
    provider: () => AgentClientPluginProviderMap[K]
  ) => {
    if (!providerKeyInfoMapRef.current[providerKey]) {
      providerKeyInfoMapRef.current[providerKey] = {} as IdProviderMap
    }
    providerKeyInfoMapRef.current[providerKey]![pluginId] = provider
  }

  const getProviders = <K extends keyof AgentClientPluginProviderMap>(
    providerKey: K
  ): AgentClientPluginProviderMap[K][] => {
    const idProviderMap = (providerKeyInfoMapRef.current[providerKey] ||
      {}) as Record<AgentPluginId, () => AgentClientPluginProviderMap[K]>

    return ProviderUtils.getValues(idProviderMap)
  }

  const getIdProviderMap = <K extends keyof AgentClientPluginProviderMap>(
    providerKey: K
  ): Record<AgentPluginId, AgentClientPluginProviderMap[K]> => {
    const idProviderMap = (providerKeyInfoMapRef.current[providerKey] ||
      {}) as Record<AgentPluginId, () => AgentClientPluginProviderMap[K]>

    return ProviderUtils.getValuesMap(idProviderMap)
  }

  const mergeProviders = <K extends keyof AgentClientPluginProviderMap>(
    providerKey: K
  ): AgentClientPluginProviderMap[K] | undefined => {
    const idProviderMap = (providerKeyInfoMapRef.current[providerKey] ||
      {}) as Record<AgentPluginId, () => AgentClientPluginProviderMap[K]>

    const result = ProviderUtils.mergeAll(idProviderMap)

    return result
  }

  return (
    <AgentClientPluginContext.Provider
      value={{
        registerProvider,
        getProviders,
        getIdProviderMap,
        mergeProviders
      }}
    >
      {children}
    </AgentClientPluginContext.Provider>
  )
}

export const useAgentPlugin = () => {
  const context = useContext(AgentClientPluginContext)
  if (!context) {
    throw new Error(
      'useAgentPlugin must be used within AgentClientPluginProvider'
    )
  }
  return context
}
