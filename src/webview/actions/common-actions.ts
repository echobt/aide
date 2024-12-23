import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { toast } from 'sonner'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export class CommonActionsCollection extends ClientActionCollection {
  readonly categoryName = 'common'

  toast(
    context: ActionContext<{
      type?: 'success' | 'info' | 'warning' | 'error' | 'message'
      message?: string
    }>
  ) {
    emitter.emit('common.toast', context)
  }
}

export const useCommonActions = () => {
  useOn('common.toast', context => {
    const { type, message } = context.actionParams

    if (message) {
      toast[type ?? 'info'](message)
    }
  })
}
