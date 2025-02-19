import { useEffect, useRef, useState } from 'react'
import { ReloadIcon } from '@radix-ui/react-icons'
import {
  ChatContextEntity,
  ConversationEntity,
  type PromptSnippet,
  type SettingsSaveType
} from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChatInput,
  type ChatInputEditorRef
} from '@webview/components/chat/editor/chat-input'
import { Button } from '@webview/components/ui/button'
import { Input } from '@webview/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { SidebarLayout } from '@webview/components/ui/sidebar/sidebar-layout'
import { ConversationContextProvider } from '@webview/contexts/conversation-context'
import { ChatProviders } from '@webview/contexts/providers'
import { api } from '@webview/network/actions-api'
import { PromptSnippetSidebar } from '@webview/pages/prompt-snippet/components/prompt-snippet-sidebar'
import type { PromptSnippetWithSaveType } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { useQueryState } from 'nuqs'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useImmer } from 'use-immer'

export default function PromptSnippetEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editorRef = useRef<ChatInputEditorRef>(null)

  const [mode] = useQueryState('mode', {
    defaultValue: 'add' as const,
    parse: (value: string | null): 'add' | 'edit' => {
      if (value === 'add' || value === 'edit') return value
      return 'add'
    }
  })

  const [snippetId] = useQueryState('snippetId')
  const isEditing = mode === 'edit'

  // States
  const [title, setTitle] = useState('')
  const [saveType, setSaveType] = useState<SettingsSaveType>('workspace')
  const [context, setContext] = useImmer(
    new ChatContextEntity({
      conversations: [new ConversationEntity().entity]
    }).entity
  )
  const conversation = context.conversations[0]!
  const setConversation = (updater: any) => {
    if (typeof updater === 'function') {
      setContext(draft => {
        updater(draft.conversations[0]!)
      })
    } else {
      setContext(draft => {
        draft.conversations[0] = updater
      })
    }
  }

  // Query snippets
  const { data: snippets = [] } = useQuery({
    queryKey: ['promptSnippets'],
    queryFn: ({ signal }) =>
      api.actions().server.promptSnippet.getSnippets({
        actionParams: { isRefresh: true, withSaveType: true },
        abortController: signalToController(signal)
      }) as Promise<PromptSnippetWithSaveType[]>
  })

  const editingSnippet = snippets.find(snippet => snippet.id === snippetId)

  // Load existing snippet data
  useEffect(() => {
    if (!editingSnippet) return

    // eslint-disable-next-line unused-imports/no-unused-vars
    const { title, saveType, createdAt, updatedAt, ...rest } = editingSnippet
    setContext(draft => {
      draft.conversations[0] = {
        ...new ConversationEntity().entity,
        ...rest
      }
    })
    setTitle(title)
    setSaveType(saveType)

    setTimeout(() => {
      editorRef.current?.reInitializeEditor()
    }, 0)
  }, [editingSnippet])

  // Mutations
  const addSnippetMutation = useMutation({
    mutationFn: (data: {
      snippet: Omit<PromptSnippet, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
      }
      saveType: SettingsSaveType
    }) =>
      api.actions().server.promptSnippet.addSnippet({
        actionParams: {
          snippet: data.snippet,
          saveType: data.saveType,
          isRefresh: true
        }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promptSnippets'] })
      toast.success('New prompt snippet added successfully')
      navigate('/settings?pageId=promptSnippets')
    },
    onError: error => {
      logAndToastError('Failed to add prompt snippet', error)
    }
  })

  const updateSnippetMutation = useMutation({
    mutationFn: (data: {
      id: string
      updates: Partial<Omit<PromptSnippet, 'id' | 'createdAt' | 'updatedAt'>>
    }) =>
      api.actions().server.promptSnippet.updateSnippet({
        actionParams: { ...data, isRefresh: true }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promptSnippets'] })
      toast.success('Prompt snippet updated successfully')
      navigate('/settings?pageId=promptSnippets')
    },
    onError: error => {
      logAndToastError('Failed to update prompt snippet', error)
    }
  })

  const currentSnippet: PromptSnippet = {
    schemaVersion: conversation.schemaVersion,
    contents: conversation.contents,
    id: conversation.id,
    mentions: conversation.mentions,
    richText: conversation.richText,
    state: conversation.state,
    createdAt: conversation.createdAt,
    updatedAt: conversation.createdAt,
    title
  }

  const handleSave = () => {
    if (isEditing && snippetId) {
      updateSnippetMutation.mutate({
        id: snippetId,
        updates: currentSnippet
      })
    } else {
      addSnippetMutation.mutate({
        snippet: currentSnippet,
        saveType
      })
    }
  }

  const loading =
    addSnippetMutation.isPending || updateSnippetMutation.isPending

  return (
    <SidebarLayout
      title=""
      leftSidebar={<PromptSnippetSidebar currentSnippet={currentSnippet} />}
    >
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="p-4 flex flex-col space-y-4">
            {/* Title and Actions Row */}
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">
                {isEditing ? 'Edit Prompt Snippet' : 'Add New Prompt Snippet'}
              </h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings?pageId=promptSnippets')}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading || !title.trim()}
                >
                  {loading && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>

            {/* Title and Save Type Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter snippet title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              {!isEditing && (
                <div className="w-[200px]">
                  <Select
                    value={saveType}
                    onValueChange={value =>
                      setSaveType(value as SettingsSaveType)
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select save type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="workspace">Workspace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="flex-1 flex flex-col">
          <ChatProviders
            disableEffect
            chatStoreOverrides={{
              context,
              setContext
            }}
          >
            <ConversationContextProvider
              conversation={conversation}
              setConversation={setConversation}
            >
              <ChatInput
                editorRef={editorRef}
                autoFocus
                className="flex-1"
                editorWrapperClassName="h-full border-none rounded-none"
                editorClassName="px-0 py-2 max-h-none"
                sendButtonDisabled
                hideModelSelector
              />
            </ConversationContextProvider>
          </ChatProviders>
        </div>
      </div>
    </SidebarLayout>
  )
}
