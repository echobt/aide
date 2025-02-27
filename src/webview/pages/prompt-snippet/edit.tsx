import { useEffect, useRef } from 'react'
import { ReloadIcon } from '@radix-ui/react-icons'
import {
  ChatContextEntity,
  ConversationEntity,
  type PromptSnippet,
  type SettingsSaveType
} from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { PromptSnippetSidebar } from '@webview/pages/prompt-snippet/components/prompt-snippet-sidebar'
import type { PromptSnippetWithSaveType } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { useQueryState } from 'nuqs'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useImmer } from 'use-immer'

export type PromptSnippetEditPageMode = 'add' | 'edit'

interface PromptSnippetForm {
  title: string
  saveType: SettingsSaveType
}

export default function PromptSnippetEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { invalidateQueries } = useInvalidateQueries()
  const editorRef = useRef<ChatInputEditorRef>(null)

  const [mode] = useQueryState('mode', {
    defaultValue: 'add' as const,
    parse: (value: string | null): PromptSnippetEditPageMode => {
      if (value === 'add' || value === 'edit') return value
      return 'add'
    }
  })

  const [snippetId] = useQueryState('snippetId')
  const isEditing = mode === 'edit'

  const { register, setValue, control, reset } = useForm<PromptSnippetForm>({
    defaultValues: {
      title: '',
      saveType: 'workspace'
    }
  })

  const title = useWatch({ control, name: 'title' })
  const saveType = useWatch({ control, name: 'saveType' })

  // States
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

  // Reset form and context when mode changes
  useEffect(() => {
    reset()
    setContext(
      new ChatContextEntity({
        conversations: [new ConversationEntity().entity]
      }).entity
    )

    setTimeout(() => {
      editorRef.current?.reInitializeEditor()
    }, 0)
  }, [mode, reset])

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
    setValue('title', title)
    setValue('saveType', saveType)

    setTimeout(() => {
      editorRef.current?.reInitializeEditor()
    }, 0)
  }, [editingSnippet, setValue])

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
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['promptSnippets']
      })
      toast.success(t('webview.promptSnippet.addedSuccessfully'))
      navigate('/settings?pageId=promptSnippets')
    },
    onError: error => {
      logAndToastError(t('webview.promptSnippet.failedToAdd'), error)
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
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['promptSnippets']
      })
      toast.success(t('webview.promptSnippet.updatedSuccessfully'))
      navigate('/settings?pageId=promptSnippets')
    },
    onError: error => {
      logAndToastError(t('webview.promptSnippet.failedToUpdate'), error)
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
                {isEditing
                  ? t('webview.promptSnippet.editTitle')
                  : t('webview.promptSnippet.addNewTitle')}
              </h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings?pageId=promptSnippets')}
                >
                  {t('webview.common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading || !title.trim()}
                >
                  {loading && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing
                    ? t('webview.common.update')
                    : t('webview.common.add')}
                </Button>
              </div>
            </div>

            {/* Title and Save Type Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('webview.promptSnippet.enterTitle')}
                  {...register('title')}
                  className="h-9 text-sm"
                />
              </div>
              {!isEditing && (
                <div className="w-[200px]">
                  <Select
                    value={saveType}
                    onValueChange={value =>
                      setValue('saveType', value as SettingsSaveType)
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue
                        placeholder={t('webview.promptSnippet.selectSaveType')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        {t('webview.common.global')}
                      </SelectItem>
                      <SelectItem value="workspace">
                        {t('webview.common.workspace')}
                      </SelectItem>
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
