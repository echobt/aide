import React, { useState } from 'react'
import { Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'
import type { PromptSnippet } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  SidebarItem,
  type SidebarAction
} from '@webview/components/ui/sidebar/sidebar-item'
import { SidebarList } from '@webview/components/ui/sidebar/sidebar-list'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { useOpenPromptSnippetPage } from '@webview/hooks/api/use-open-prompt-snippet-page'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

export const PromptSnippetSidebar: React.FC<{
  currentSnippet: PromptSnippet
}> = ({ currentSnippet }) => {
  const { invalidateQueries } = useInvalidateQueries()
  const [searchQuery, setSearchQuery] = useState('')
  const { openPromptSnippetEditPage } = useOpenPromptSnippetPage()

  // Query snippets
  const { data: snippets = [] } = useQuery({
    queryKey: ['promptSnippets', searchQuery],
    queryFn: ({ signal }) =>
      api.actions().server.promptSnippet.getSnippets({
        actionParams: {
          isRefresh: true,
          withSaveType: true,
          keyword: searchQuery
        },
        abortController: signalToController(signal)
      })
  })

  // Delete mutation
  const removeSnippetsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.promptSnippet.removeSnippets({
        actionParams: { ids }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['promptSnippets']
      })
      toast.success('Prompt snippet(s) removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove prompt snippet', error)
    }
  })

  const handleAddNew = () => {
    openPromptSnippetEditPage({
      mode: 'add'
    })
  }

  const handleSelect = (snippet: PromptSnippet) => {
    openPromptSnippetEditPage({
      mode: 'edit',
      snippetId: snippet.id
    })
  }

  const getSnippetActions = (snippet: PromptSnippet): SidebarAction[] => [
    {
      label: 'Edit',
      icon: Pencil2Icon,
      onClick: () => handleSelect(snippet)
    },
    {
      label: 'Delete',
      icon: TrashIcon,
      onClick: () => removeSnippetsMutation.mutate([snippet.id]),
      className: 'text-destructive focus:text-destructive'
    }
  ]

  const snippetsForRender = [
    ...snippets.filter(snippet => snippet.id !== currentSnippet.id),
    currentSnippet
  ].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <SidebarList
      items={snippetsForRender}
      idField="id"
      title="Prompt Snippets"
      itemName="snippet"
      searchPlaceholder="Search snippets..."
      onSearch={setSearchQuery}
      onCreateItem={handleAddNew}
      onDeleteItems={items => {
        removeSnippetsMutation.mutate(items.map(item => item.id))
      }}
      renderItem={renderItemProps => (
        <SidebarItem
          {...renderItemProps}
          isActive={renderItemProps.item.id === currentSnippet.id}
          title={renderItemProps.item.title || 'Untitled'}
          onClick={() => handleSelect(renderItemProps.item)}
          actions={getSnippetActions(renderItemProps.item)}
        />
      )}
    />
  )
}
