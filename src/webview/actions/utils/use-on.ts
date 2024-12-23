import { useEffect } from 'react'
import type { AllClientActionsConfigs } from '@shared/actions/types'

import { emitter } from './emitter'

type ValidActionEvent = {
  [T in AllClientActionsConfigs as `${T['context']['actionCategory']}.${T['context']['actionName']}`]: T['context']
}

/**
 * Hook for subscribing to action events with type safety
 * @param event - The event name to subscribe to
 * @param callback - The callback function to be called when the event is emitted
 */
export const useOn = <E extends keyof ValidActionEvent>(
  event: E,
  callback: (context: ValidActionEvent[E]) => void
) => {
  useEffect(() => {
    emitter.on(event, callback)
    return () => {
      emitter.off(event, callback)
    }
  }, [event, callback])
}
