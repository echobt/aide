import { useEffect, useState } from 'react'
import type { PromptSnippetWithSaveType } from '@extension/actions/prompt-snippet-actions'
import { ReloadIcon } from '@radix-ui/react-icons'
import {
  ChatContextEntity,
  ConversationEntity,
  type Conversation,
  type SettingsSaveType
} from '@shared/entities'
import { ChatInput } from '@webview/components/chat/editor/chat-input'
import { Button } from '@webview/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import { Input } from '@webview/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { ChatProviders } from '@webview/contexts/providers'
import { useImmer, type Updater } from 'use-immer'

interface PromptSnippetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  onSave: (snippet: PromptSnippetWithSaveType) => void
  editingSnippet?: PromptSnippetWithSaveType
}

export const PromptSnippetDialog = ({
  open,
  onOpenChange,
  loading,
  onSave,
  editingSnippet
}: PromptSnippetDialogProps) => {
  const isEditing = !!editingSnippet
  const [title, setTitle] = useState(editingSnippet?.title || '')
  const [saveType, setSaveType] = useState<SettingsSaveType>(
    editingSnippet?.saveType || 'workspace'
  )
  const [context, setContext] = useImmer(
    new ChatContextEntity({
      conversations: [new ConversationEntity().entity]
    }).entity
  )

  useEffect(() => {
    if (!editingSnippet) return

    const { title, saveType, ...rest } = editingSnippet
    setContext(draft => {
      draft.conversations[0] = {
        ...new ConversationEntity().entity,
        ...rest
      }
    })
    setTitle(title)
    setSaveType(saveType)
  }, [editingSnippet])

  const conversation = context.conversations[0]!
  const setConversation: Updater<Conversation> = (updater, ...args) => {
    if (typeof updater === 'function') {
      setContext(draft => {
        updater(draft.conversations[0]!, ...args)
      })
    } else {
      setContext(draft => {
        draft.conversations[0] = updater
      })
    }
  }

  const finalSnippetWithSaveType: PromptSnippetWithSaveType = {
    schemaVersion: conversation.schemaVersion,
    contents: conversation.contents,
    id: conversation.id,
    mentions: conversation.mentions,
    richText: conversation.richText,
    state: conversation.state,
    title,
    saveType
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {editingSnippet ? 'Edit Prompt Snippet' : 'Add New Prompt Snippet'}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="flex flex-col h-full space-y-4 mt-4">
          <Input
            placeholder="Enter snippet title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="shrink-0 text-sm"
          />
          <div className="flex-1">
            <ChatProviders>
              <ChatInput
                autoFocus
                className="h-full border rounded-lg px-2"
                editorClassName="px-2 max-h-none"
                context={context}
                setContext={setContext}
                conversation={conversation}
                setConversation={setConversation}
                sendButtonDisabled
                hideModelSelector
              />
            </ChatProviders>
          </div>
          {!isEditing && (
            <Select
              value={saveType}
              onValueChange={value => setSaveType(value as SettingsSaveType)}
            >
              <SelectTrigger className="text-sm shrink-0">
                <SelectValue placeholder="Select save type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="workspace">Workspace</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={() => {
              onSave(finalSnippetWithSaveType)
            }}
            disabled={loading}
            className="w-full text-sm shrink-0"
          >
            {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            {editingSnippet ? 'Update Snippet' : 'Add Snippet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
