import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type FC,
  type Ref
} from 'react'
import { $generateHtmlFromNodes } from '@lexical/html'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import {
  LexicalComposer,
  type InitialConfigType
} from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { type ImageInfo } from '@shared/entities'
import { useDropHandler } from '@webview/lexical/hooks/use-drop-handler'
import { usePasteHandler } from '@webview/lexical/hooks/use-paste-handler'
import { MentionNode } from '@webview/lexical/nodes/mention-node'
import {
  MentionPlugin,
  type MentionPluginProps
} from '@webview/lexical/plugins/mention-plugin'
import type { FileInfo } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor
} from 'lexical'

const onError = (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Editor error:', error)
}

export interface ChatEditorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>,
    MentionPluginProps {
  ref?: Ref<ChatEditorRef>
  className?: string
  contentEditableClassName?: string
  initialConfig?: Partial<InitialConfigType>
  placeholder?: string | string[]
  autoFocus?: boolean
  onComplete?: (
    editorState: EditorState,
    editor: LexicalEditor,
    tags: Set<string>
  ) => void
  onChange?: (
    editorState: EditorState,
    editor: LexicalEditor,
    tags: Set<string>
  ) => void
  onPasteImage?: (image: ImageInfo) => void
  onDropFiles?: (files: FileInfo[]) => void
  onFocus?: () => void
  onBlur?: () => void
  onClickFocus?: () => void
}

export interface ChatEditorRef {
  editor: LexicalEditor
  insertSpaceAndAt: () => void
  focusOnEditor: (autoMoveCursorToEnd?: boolean) => void
  resetEditor: () => void
  copyWithFormatting: () => void
}

export const ChatEditor: FC<ChatEditorProps> = ({
  ref,
  className,
  initialConfig,
  placeholder,
  autoFocus = false,
  onComplete,
  onChange,
  onPasteImage,
  onDropFiles,
  ...otherProps
}) => {
  const id = useId()
  const finalInitialConfig: InitialConfigType = {
    namespace: `TextComponentEditor-${id}`,
    // theme: normalTheme,
    onError,
    editable: true,
    nodes: [MentionNode],
    ...initialConfig
  }

  return (
    <LexicalComposer initialConfig={finalInitialConfig}>
      <ChatEditorInner
        ref={ref}
        className={className}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onComplete={onComplete}
        onChange={onChange}
        onPasteImage={onPasteImage}
        onDropFiles={onDropFiles}
        {...otherProps}
      />
    </LexicalComposer>
  )
}

const ChatEditorInner: FC<ChatEditorProps> = ({
  ref,
  className,
  contentEditableClassName,
  // eslint-disable-next-line unused-imports/no-unused-vars
  placeholder,
  autoFocus,
  onComplete,
  onChange,
  onPasteImage,
  onDropFiles,
  onFocus,
  onBlur,
  onClickFocus,

  // div props
  ...otherProps
}) => {
  const [editor] = useLexicalComposerContext()
  const isFocusedRef = useRef(false)

  const insertSpaceAndAt = () => {
    editor.focus()
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(' @')
      }
    })
  }

  const focusOnEditor = (autoMoveCursorToEnd = false) => {
    setTimeout(() => {
      const rootEl = editor.getRootElement()

      if (!rootEl?.children?.length) {
        rootEl?.focus({
          preventScroll: true
        }) // if the editor is empty, focus on it
      } else {
        editor.focus(
          () => {
            rootEl.focus({
              preventScroll: true
            })
          },
          {
            defaultSelection: 'rootEnd'
          }
        )

        if (autoMoveCursorToEnd) {
          // move the cursor to the end of the editor
          editor.update(() => {
            const root = $getRoot()
            const lastChild = root.getLastChild()
            lastChild?.selectEnd()
          })
        }
      }
    }, 0)
  }

  const resetEditor = () => {
    editor.update(() => {
      const root = $getRoot()
      root.clear()
    })
  }

  const copyWithFormatting = () => {
    editor.update(() => {
      const htmlString = $generateHtmlFromNodes(editor)
      // Create a temporary element to hold the HTML content
      const tempElement = document.createElement('div')
      tempElement.innerHTML = htmlString

      // Create a range and selection
      const range = document.createRange()
      range.selectNodeContents(tempElement)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      // Execute copy command
      document.execCommand('copy')

      // Clean up
      selection?.removeAllRanges()
      tempElement.remove()
    })
  }

  useEffect(() => {
    if (!autoFocus) return
    focusOnEditor()
  }, [autoFocus, focusOnEditor])

  useImperativeHandle(
    // eslint-disable-next-line react-compiler/react-compiler
    ref,
    () => ({
      editor,
      insertSpaceAndAt,
      focusOnEditor,
      resetEditor,
      copyWithFormatting
    }),
    [editor]
  )

  useEffect(() => {
    const removeKeyEnterListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      event => {
        if (event && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          const currentState = editor.getEditorState()
          const tags = new Set<string>()
          onComplete?.(currentState, editor, tags)
          return true // prevent other Enter behaviors
        }

        return false // allow other Enter behaviors
      },
      COMMAND_PRIORITY_CRITICAL
    )

    return () => {
      removeKeyEnterListener()
    }
  }, [editor, onComplete])

  useEffect(() => {
    const handleDocumentFocus = () => {
      const rootEl = editor.getRootElement()
      // Check if the active element is the editor or any of its children
      const isEditorFocused = rootEl?.contains(document.activeElement)

      if (isEditorFocused) {
        onFocus?.()
      } else {
        isFocusedRef.current = false
        onBlur?.()
      }
    }

    // Listen for focus changes on the document
    document.addEventListener('focusin', handleDocumentFocus)
    document.addEventListener('focusout', handleDocumentFocus)

    return () => {
      document.removeEventListener('focusin', handleDocumentFocus)
      document.removeEventListener('focusout', handleDocumentFocus)
    }
  }, [editor, onBlur, onFocus])

  usePasteHandler({
    editor,
    onPasteImage
  })

  useDropHandler({
    editor,
    onDropFiles
  })

  return (
    <div
      className={cn('editor-container relative', className)}
      tabIndex={1}
      onClick={() => {
        if (!isFocusedRef.current) {
          onClickFocus?.()
          isFocusedRef.current = true
        }
      }}
      {...otherProps}
    >
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className={cn(
              'editor-input min-h-24 min-w-full py-2 outline-hidden',
              contentEditableClassName
            )}
          />
        }
        // placeholder={placeholder}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnChangePlugin onChange={onChange!} />
      <MentionPlugin />
      <HistoryPlugin />
      {autoFocus && <AutoFocusPlugin defaultSelection="rootEnd" />}
      <TabIndentationPlugin />
      {/* <TreeViewDebugPlugin /> */}
    </div>
  )
}
