import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export class PromptSnippetActionsCollection extends ClientActionCollection {
  readonly categoryName = 'promptSnippet'

  openPromptSnippetEditPage(
    context: ActionContext<{
      snippetId?: string
      refreshPromptSnippets?: boolean
      toastMessage?: string
    }>
  ) {
    emitter.emit('promptSnippet.openPromptSnippetEditPage', context)
  }

  refreshPromptSnippets(context: ActionContext<{}>) {
    emitter.emit('promptSnippet.refreshPromptSnippets', context)
  }
}

export const usePromptSnippetActions = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { pathname } = location

  useOn('promptSnippet.openPromptSnippetEditPage', async context => {
    const { toastMessage, snippetId, refreshPromptSnippets } =
      context.actionParams

    if (refreshPromptSnippets) {
      await queryClient.invalidateQueries({
        queryKey: ['promptSnippets']
      })
    }

    if (toastMessage) {
      toast.info(toastMessage)
    }

    navigate(
      snippetId
        ? `/prompt-snippet/edit?snippetId=${snippetId}&mode=edit`
        : '/prompt-snippet/edit?mode=add',
      {
        replace: pathname === '/prompt-snippet/edit'
      }
    )
  })

  useOn('promptSnippet.refreshPromptSnippets', async context => {
    await queryClient.invalidateQueries({
      queryKey: ['promptSnippets']
    })
  })
}
