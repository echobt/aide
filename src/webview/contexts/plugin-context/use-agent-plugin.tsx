/* eslint-disable react-compiler/react-compiler */
/* eslint-disable lines-around-directive */
import { Fragment } from 'react'
import type { ConversationAction } from '@shared/entities'
import type {
  CustomRenderFloatingActionItemProps,
  CustomRenderThinkItemProps,
  IsCompletedAction,
  IsSameAction
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

export const CustomRenderFloatingActionItem: SFC<
  CustomRenderFloatingActionItemProps
> = props => {
  'use no memo'

  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('CustomRenderFloatingActionItem')

  return (
    <>
      {Object.entries(idProviderMap).map(([id, render]) =>
        props.conversationAction.agent?.name === id ? (
          <Fragment key={id}>{render(props)}</Fragment>
        ) : null
      )}
    </>
  )
}

export const useAgentPluginIsShowInFloatingActionItem = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('CustomRenderFloatingActionItem')

  return (action: ConversationAction) => {
    const render = idProviderMap[action.agent?.name as AgentPluginId]
    return Boolean(render)
  }
}

export const useAgentPluginIsSameAction = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('isSameAction')

  const isSameAction: IsSameAction = (actionA, actionB) => {
    if (!actionA.agent?.name || !actionB.agent?.name) return false
    if (actionA.agent?.name !== actionB.agent?.name) return false

    const _isSameAction = idProviderMap[actionA.agent.name as AgentPluginId]
    if (!_isSameAction) return false

    return _isSameAction(actionA, actionB)
  }

  return isSameAction
}

export const useAgentPluginIsCompletedAction = () => {
  const { getIdProviderMap } = useAgentPlugin()
  const idProviderMap = getIdProviderMap('isCompletedAction')

  const isCompletedAction: IsCompletedAction = action => {
    if (!action.agent?.name) return true
    const _isCompletedAction = idProviderMap[action.agent.name as AgentPluginId]
    if (!_isCompletedAction) return true

    return _isCompletedAction(action)
  }

  return isCompletedAction
}
