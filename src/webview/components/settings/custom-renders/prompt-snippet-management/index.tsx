import { useState } from 'react'
import type { PromptSnippetWithSaveType } from '@extension/actions/prompt-snippet-actions'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PromptSnippetCard } from './prompt-snippet-card'

// Query key for prompt snippets
const promptSnippetsQueryKey = ['promptSnippets'] as const

export const PromptSnippetManagement = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  // Queries
  const { data: _snippets = [] } = useQuery({
    queryKey: [...promptSnippetsQueryKey, searchQuery],
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

  const snippets = _snippets as PromptSnippetWithSaveType[]

  const removeSnippetsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.promptSnippet.removeSnippets({
        actionParams: { ids }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promptSnippetsQueryKey })
      toast.success('Prompt snippet removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove prompt snippet', error)
    }
  })

  const handleEditSnippet = (snippet: PromptSnippetWithSaveType) => {
    navigate(`/prompt-snippet/edit?mode=edit&snippetId=${snippet.id}`)
  }

  const handleAddSnippet = () => {
    navigate('/prompt-snippet/edit?mode=add')
  }

  const handleRemoveSnippets = (items: PromptSnippetWithSaveType[]) => {
    removeSnippetsMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  return (
    <div className="space-y-4">
      <CardList
        items={snippets}
        idField="id"
        draggable={false}
        minCardWidth={300}
        onCreateItem={handleAddSnippet}
        onDeleteItems={handleRemoveSnippets}
        headerLeftActions={
          <Input
            placeholder="Search prompt snippets..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: snippet, isSelected, onSelect }) => (
          <PromptSnippetCard
            snippet={snippet}
            onEdit={handleEditSnippet}
            onRemove={() => handleRemoveSnippets([snippet])}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )}
      />
    </div>
  )
}
