import React, { useState } from 'react'
import type { PromptSnippetWithSaveType } from '@extension/actions/prompt-snippet-actions'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import type { PromptSnippet } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@webview/components/ui/button'
import { Input } from '@webview/components/ui/input'
import { api } from '@webview/network/actions-api'
import { cn, logAndToastError } from '@webview/utils/common'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

export const PromptSnippetSidebar: React.FC<{
  currentSnippet: PromptSnippet
}> = ({ currentSnippet }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  // Query snippets
  const { data: snippets = [], isLoading } = useQuery({
    queryKey: ['promptSnippets', searchQuery],
    queryFn: ({ signal }) =>
      searchQuery
        ? (api.actions().server.promptSnippet.searchSnippets({
            actionParams: { query: searchQuery, withSaveType: true },
            abortController: signalToController(signal)
          }) as Promise<PromptSnippetWithSaveType[]>)
        : (api.actions().server.promptSnippet.getSnippets({
            actionParams: { isRefresh: true, withSaveType: true },
            abortController: signalToController(signal)
          }) as Promise<PromptSnippetWithSaveType[]>)
  })

  // Delete mutation
  const removeSnippetMutation = useMutation({
    mutationFn: (id: string) =>
      api.actions().server.promptSnippet.removeSnippet({
        actionParams: { id }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptSnippets'] })
      toast.success('Prompt snippet removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove prompt snippet', error)
    }
  })

  const handleAddNew = () => {
    navigate('/prompt-snippet/edit?mode=add')
  }

  const handleSelect = (snippet: PromptSnippet) => {
    navigate(`/prompt-snippet/edit?mode=edit&snippetId=${snippet.id}`)
  }

  const handleDelete = async (e: React.MouseEvent, snippet: PromptSnippet) => {
    e.stopPropagation()
    removeSnippetMutation.mutate(snippet.id)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const snippetsForRender = [
    ...snippets.filter(snippet => snippet.id !== currentSnippet.id),
    currentSnippet
  ].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-4">
        <Button
          onClick={handleAddNew}
          className="w-full flex items-center justify-center"
        >
          <PlusIcon className="mr-2 size-4" />
          New Snippet
        </Button>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </div>
        ) : snippetsForRender.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {searchQuery ? 'No snippets found' : 'No snippets yet'}
          </div>
        ) : (
          snippetsForRender.map(snippet => (
            <div
              key={snippet.id}
              className={cn(
                'flex items-center justify-between cursor-pointer px-2 py-1 hover:bg-secondary rounded-lg mb-2',
                {
                  'bg-secondary': snippet.id === currentSnippet.id
                }
              )}
              onClick={() => handleSelect(snippet)}
            >
              <span
                className="truncate flex-1"
                title={snippet.title || 'Untitled'}
              >
                {snippet.title || 'Untitled'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-transparent shrink-0"
                onClick={e => handleDelete(e, snippet)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))
        )}
      </nav>
    </div>
  )
}
