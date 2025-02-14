import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
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

  invalidQueryKeys(
    context: ActionContext<{
      keys: string[]
    }>
  ) {
    emitter.emit('common.invalidQueryKeys', context.actionParams.keys)
  }

  goToPage(context: ActionContext<{ path: string; replace?: boolean }>) {
    emitter.emit('common.goToPage', context)
  }
}

export const useCommonActions = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  useOn('common.toast', context => {
    const { type, message } = context.actionParams

    if (message) {
      toast[type ?? 'info'](message)
    }
  })

  useOn('common.invalidQueryKeys', keys => {
    queryClient.invalidateQueries({ queryKey: keys })
  })

  useOn('common.goToPage', context => {
    const { path, replace = false } = context.actionParams
    navigate(path, { replace })
  })
}
