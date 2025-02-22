import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useQueryClient } from '@tanstack/react-query'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export class PromptSnippetActionsCollection extends ClientActionCollection {
  readonly categoryName = 'promptSnippet'

  refreshPromptSnippets(context: ActionContext<{}>) {
    emitter.emit('promptSnippet.refreshPromptSnippets', context)
  }
}

export const usePromptSnippetActions = () => {
  const queryClient = useQueryClient()

  useOn('promptSnippet.refreshPromptSnippets', async context => {
    await queryClient.invalidateQueries({
      queryKey: ['promptSnippets']
    })
  })
}
