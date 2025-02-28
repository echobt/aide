/* eslint-disable react-compiler/react-compiler */
/* eslint-disable lines-around-directive */
import { Fragment } from 'react'
import type { Agent } from '@shared/entities'
import type {
  CustomRenderFloatingAgentItemProps,
  CustomRenderThinkItemProps,
  IsCompletedAgent,
  IsSameAgent
} from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { SFC } from '@shared/types/common'

import { useAgentPlugin } from './agent-plugin-context'

export const CustomRenderThinkItem: SFC<CustomRenderThinkItemProps> = props => {
  'use no memo'

  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('CustomRenderThinkItem')

  return (
    <>
      {Object.entries(idProviderMap).map(([id, render]) =>
        props.agent.name === id ? (
          <Fragment key={id}>{render(props)}</Fragment>
        ) : null
      )}
    </>
  )
}

export const CustomRenderFloatingAgentItem: SFC<
  CustomRenderFloatingAgentItemProps
> = props => {
  'use no memo'

  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('CustomRenderFloatingAgentItem')

  return (
    <>
      {Object.entries(idProviderMap).map(([id, render]) =>
        props.agent?.name === id ? (
          <Fragment key={id}>{render(props)}</Fragment>
        ) : null
      )}
    </>
  )
}

export const useAgentPluginIsShowInFloatingAgentItem = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('CustomRenderFloatingAgentItem')

  return (agent: Agent) => {
    if (agent.source === 'think') return false
    const render = idProviderMap[agent.name as AgentPluginId]
    return Boolean(render)
  }
}

export const useAgentPluginIsSameAgent = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('isSameAgent')

  const isSameAgent: IsSameAgent = (agentA, agentB) => {
    if (!agentA.name || !agentB.name) return false
    if (agentA.name !== agentB.name) return false

    const _isSameAgent = idProviderMap[agentA.name as AgentPluginId]
    if (!_isSameAgent) return false

    return _isSameAgent(agentA, agentB)
  }

  return isSameAgent
}

export const useAgentPluginIsCompletedAgent = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('isCompletedAgent')

  const isCompletedAgent: IsCompletedAgent = agent => {
    if (!agent.name) return true
    const _isCompletedAgent = idProviderMap[agent.name as AgentPluginId]
    if (!_isCompletedAgent) return true

    return _isCompletedAgent(agent)
  }

  return isCompletedAgent
}
