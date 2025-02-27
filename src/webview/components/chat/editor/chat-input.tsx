import { useEffect, useRef, type FC } from 'react'
import {
  ConversationEntity,
  type Conversation,
  type ImageInfo
} from '@shared/entities'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { mergeConversationContents } from '@shared/utils/chat-context-helper/common/merge-conversation-contents'
import { parseAsConversationContents } from '@shared/utils/chat-context-helper/common/parse-as-conversation-contents'
import {
  removeDuplicates,
  tryParseJSON,
  tryStringifyJSON
} from '@shared/utils/common'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { FileIcon } from '@webview/components/file-icon'
import { BorderBeam } from '@webview/components/ui/border-beam'
import { useConversationContext } from '@webview/contexts/conversation-context'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { api } from '@webview/network/actions-api'
import { type FileInfo } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { AnimatePresence, motion } from 'framer-motion'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type EditorState,
  type LexicalEditor
} from 'lexical'
import { useTranslation } from 'react-i18next'

import { ContextSelector } from '../selectors/context-selector'
import { ActionCollapsible } from './action-collapsible'
import { ChatEditor, type ChatEditorRef } from './chat-editor'
import {
  FileAttachments,
  type FileAttachmentOtherItem
} from './file-attachments'

export enum ChatInputMode {
  Default = 'default',
  MessageEdit = 'message-edit',
  MessageReadonly = 'message-readonly'
}

export interface ChatInputProps {
  ref?: React.Ref<HTMLDivElement | null>
  className?: string
  editorWrapperRef?: React.Ref<HTMLDivElement | null>
  editorWrapperClassName?: string
  editorRef?: React.Ref<ChatInputEditorRef>
  editorClassName?: string
  mode?: ChatInputMode
  isSending?: boolean
  onExitEditMode?: () => void
  autoFocus?: boolean
  borderAnimation?: boolean
  sendButtonDisabled: boolean
  hideModelSelector?: boolean
  showActionCollapsible?: boolean
  onSend?: (conversation: Conversation) => void
  showBlurBg?: boolean
}

export interface ChatInputEditorRef extends ChatEditorRef {
  reInitializeEditor: () => void
  clearInput: () => void
}

export const ChatInput: FC<ChatInputProps> = ({
  ref,
  className,
  editorWrapperRef,
  editorWrapperClassName,
  editorRef,
  editorClassName,
  mode = ChatInputMode.Default,
  onExitEditMode,
  autoFocus = false,
  isSending,
  borderAnimation = false,
  sendButtonDisabled,
  hideModelSelector = false,
  onSend,
  showActionCollapsible = false,
  showBlurBg = false
}) => {
  const { t } = useTranslation()
  const { conversation, setConversation } = useConversationContext()
  const innerEditorRef = useRef<ChatEditorRef>(null)
  const { invalidateQueries } = useInvalidateQueries()
  const handleEditorChange = async (editorState: EditorState) => {
    const newRichText = tryStringifyJSON(editorState.toJSON()) || ''

    setConversation(draft => {
      if (draft.richText !== newRichText) {
        draft.richText = newRichText
        draft.contents = mergeConversationContents(
          parseAsConversationContents(
            editorState.read(() => $getRoot().getTextContent()?.trim() || '')
          )
        )
      }
    })
  }

  const initialEditorState = (editor?: LexicalEditor) => {
    if (!editor) return

    const { richText, contents } = conversation

    if (richText) {
      const richTextObj = tryParseJSON(richText)

      if (!richTextObj) return

      const editorState = editor.parseEditorState(richTextObj)
      editor.setEditorState(editorState)
    } else if (contents) {
      // todo: add support for content, a common string
      editor.update(() => {
        const root = $getRoot()
        const paragraph = $createParagraphNode()
        const text = $createTextNode(
          getAllTextFromConversationContents(contents)
        )
        paragraph.append(text)
        root.clear()
        root.append(paragraph)
      })
    } else {
      editor.update(() => {
        $getRoot().clear()
      })
    }
  }

  const getConversation = useCallbackRef(() => conversation)
  const handleSend = async () => {
    if (sendButtonDisabled || !onSend) return
    const editorState = innerEditorRef.current?.editor.getEditorState()

    if (editorState) {
      await handleEditorChange(editorState)
    }

    // refresh mentions
    const newConversation = await api
      .actions()
      .server.mention.refreshConversationMentions({
        actionParams: { conversation: getConversation() }
      })

    logger.verbose('send conversation', newConversation)
    onSend(newConversation)
  }

  const focusOnEditor = () => {
    innerEditorRef.current?.focusOnEditor()
  }

  useEffect(() => {
    innerEditorRef.current?.editor.setEditable(
      ![ChatInputMode.MessageReadonly].includes(mode)
    )
  }, [mode])

  const reInitializeEditor = () => {
    initialEditorState(innerEditorRef.current?.editor)
  }

  const clearInput = () => {
    setConversation(draft => {
      draft.richText = ''
      draft.contents = []
    })
  }

  const handleRef = (node: ChatEditorRef | null) => {
    innerEditorRef.current = node
    if (typeof editorRef === 'function') {
      editorRef({
        ...node,
        reInitializeEditor,
        clearInput
      } as ChatInputEditorRef)
    } else if (editorRef) {
      // eslint-disable-next-line react-compiler/react-compiler
      editorRef.current = {
        ...node,
        reInitializeEditor,
        clearInput
      } as ChatInputEditorRef
    }
  }

  const handlePasteImage = (image: ImageInfo) => {
    setConversation(draft => {
      draft.state.selectedImagesFromOutsideUrl = removeDuplicates(
        [...draft.state.selectedImagesFromOutsideUrl, image],
        ['url']
      )
    })
  }

  const handleDropFiles = (files: FileInfo[]) => {
    setConversation(draft => {
      draft.state.selectedFilesFromFileSelector = removeDuplicates(
        [...draft.state.selectedFilesFromFileSelector, ...files],
        ['schemeUri']
      )
    })
  }

  const handleEditorClickFocus = () => {
    if (!isSending) {
      invalidateQueries({
        type: 'current-webview',
        queryKeys: ['realtime']
      })
    }
  }

  return (
    <AnimatePresence initial={false}>
      <div ref={ref} className={cn('flex flex-col', className)}>
        {showActionCollapsible && (
          <ActionCollapsible className="mb-[-5px] pb-[5px]" />
        )}
        <motion.div
          ref={editorWrapperRef}
          layout
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ willChange: 'auto' }}
          className={cn(
            'chat-input relative px-2 shrink-0 w-full flex flex-col border-t',
            [ChatInputMode.MessageReadonly, ChatInputMode.MessageEdit].includes(
              mode
            ) && 'border-none px-0',
            [ChatInputMode.MessageReadonly].includes(mode) && 'cursor-pointer',
            editorWrapperClassName
          )}
        >
          <AnimatedFileAttachments className="shrink-0" mode={mode} />

          <motion.div
            layout="preserve-aspect"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ willChange: 'auto' }}
            className="flex flex-col flex-1"
          >
            <ChatEditor
              ref={handleRef}
              initialConfig={{
                editable: ![ChatInputMode.MessageReadonly].includes(mode),
                editorState: initialEditorState
              }}
              onComplete={onSend ? handleSend : undefined}
              onChange={handleEditorChange}
              placeholder={[
                t('webview.chat.typeMessageHere'),
                t('webview.chat.webExample'),
                t('webview.chat.fileReviewExample')
              ]}
              autoFocus={autoFocus}
              className={cn(
                'flex-1 min-h-24 max-h-64 overflow-y-auto rounded-lg shadow-none focus-visible:ring-0',
                [
                  ChatInputMode.MessageReadonly,
                  ChatInputMode.MessageEdit
                ].includes(mode) && 'rounded-none border-none my-0',
                [ChatInputMode.MessageReadonly].includes(mode) &&
                  'min-h-0 min-w-0 h-auto w-auto',
                editorClassName
              )}
              contentEditableClassName={cn(
                [ChatInputMode.MessageReadonly].includes(mode) &&
                  'min-h-0 min-w-0 h-auto w-auto'
              )}
              onPasteImage={handlePasteImage}
              onDropFiles={handleDropFiles}
              onClickFocus={handleEditorClickFocus}
            />

            <AnimatePresence mode="wait">
              {![ChatInputMode.MessageReadonly].includes(mode) && (
                <motion.div
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ willChange: 'auto' }}
                  className={cn(
                    'chat-input-actions shrink-0 flex justify-between',
                    [ChatInputMode.MessageEdit].includes(mode) && 'px-2',
                    [ChatInputMode.MessageEdit, ChatInputMode.Default].includes(
                      mode
                    ) && 'mb-2'
                  )}
                >
                  <ContextSelector
                    hideModelSelector={hideModelSelector}
                    onClickMentionSelector={() => {
                      innerEditorRef.current?.insertSpaceAndAt()
                    }}
                    onFocusOnEditor={focusOnEditor}
                    showExitEditModeButton={mode === ChatInputMode.MessageEdit}
                    onExitEditMode={onExitEditMode}
                  />
                  {onSend && (
                    <ButtonWithTooltip
                      variant="outline"
                      disabled={sendButtonDisabled}
                      size="xs"
                      className="ml-auto rounded-md"
                      onClick={handleSend}
                      tooltip={t('webview.chat.sendShortcut')}
                    >
                      ⌘↩ {t('webview.chat.send')}
                    </ButtonWithTooltip>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          {borderAnimation && <BorderBeam duration={2} delay={0.5} />}
          {showBlurBg && (
            <div className="absolute inset-0 z-[-1] backdrop-blur-sm" />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

interface AnimatedFileAttachmentsProps {
  mode: ChatInputMode
  className: string
}

export const AnimatedFileAttachments: React.FC<
  AnimatedFileAttachmentsProps
> = ({ mode, className }) => {
  const { t } = useTranslation()
  const { conversation, setConversation } = useConversationContext()
  const selectedFiles = conversation?.state?.selectedFilesFromFileSelector || []
  const setSelectedFiles = (files: FileInfo[]) => {
    setConversation(draft => {
      if (!draft.state) {
        draft.state = new ConversationEntity(t).entity.state
      }
      draft.state.selectedFilesFromFileSelector = removeDuplicates(files, [
        'schemeUri'
      ])
    })
  }

  const selectedOtherItems: FileAttachmentOtherItem[] =
    conversation.state?.selectedImagesFromOutsideUrl?.map(
      img =>
        ({
          id: img.url,
          label: img.name || 'image',
          type: 'image',
          icon: <FileIcon className="size-2.5 mr-1" filePath="example.png" />,
          item: img,
          previewConfig: {
            type: 'image',
            url: img.url
          }
        }) satisfies FileAttachmentOtherItem
    )

  const setSelectedOtherItems = (items: FileAttachmentOtherItem[]) => {
    setConversation(draft => {
      const selectedImages: ImageInfo[] = []
      items.forEach(item => {
        if (item.type === 'image') {
          selectedImages.push(item.item as ImageInfo)
        }
      })

      draft.state.selectedImagesFromOutsideUrl = removeDuplicates(
        selectedImages,
        ['url']
      )
    })
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        layout="preserve-aspect"
        initial={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ willChange: 'auto' }}
        className={className}
        onClick={e => {
          e.stopPropagation()
        }}
      >
        <FileAttachments
          className={cn(
            [ChatInputMode.MessageReadonly, ChatInputMode.MessageEdit].includes(
              mode
            ) && 'px-2'
          )}
          hideRemoveButton={[ChatInputMode.MessageReadonly].includes(mode)}
          showFileSelector={![ChatInputMode.MessageReadonly].includes(mode)}
          selectedFiles={selectedFiles}
          selectedOtherItems={selectedOtherItems}
          onSelectedFilesChange={setSelectedFiles}
          onSelectedOtherItemsChange={setSelectedOtherItems}
        />
      </motion.div>
    </AnimatePresence>
  )
}
