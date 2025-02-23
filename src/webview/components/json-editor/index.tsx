/* eslint-disable react-compiler/react-compiler */
import { useRef, useState } from 'react'
import type { ChangeEvent, FC } from 'react'
import Editor, {
  BeforeMount,
  OnMount,
  OnValidate,
  type Monaco
} from '@monaco-editor/react'
import { useGlobalContext } from '@webview/contexts/global-context'
import { cn } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import {
  Code,
  Download,
  FileJson,
  MinusSquare,
  RotateCcw,
  Trash2,
  Upload,
  WrenchIcon
} from 'lucide-react'
import type { editor } from 'monaco-editor'

import { ButtonWithTooltip } from '../button-with-tooltip'
import { Alert, AlertDescription } from '../ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Separator } from '../ui/separator'
import {
  downloadJsonFile,
  minifyJsonString,
  prettifyJsonString
} from './helper/utils'
import { tryFixJson } from './helper/validation'
import type { EditorMarker } from './types'

interface ActionGroup {
  label: string
  actions: {
    icon: React.ReactNode
    label: string
    onClick: () => void
    disabled?: boolean
    isUpload?: boolean
    onUpload?: (event: ChangeEvent<HTMLInputElement>) => void
  }[]
}

interface JSONEditorProps {
  defaultValue?: string
  schemaValue?: string
  title?: string
  path?: string
  placeholder?: string
  onChange?: (value?: string) => void
  onBlur?: (value: string, isValid?: boolean) => void
  className?: string
}

export const JSONEditor: FC<JSONEditorProps> = ({
  defaultValue,
  schemaValue,
  title = 'JSON Editor',
  path = '',
  placeholder,
  onChange,
  onBlur,
  className
}) => {
  const { isDarkTheme } = useGlobalContext()
  const theme = isDarkTheme ? 'vs-dark' : 'vs-light'
  const [errors, setErrors] = useState<string[]>([])
  const [isValidJson, setIsValidJson] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null)

  // Editor mount handlers
  const handleEditorWillMount: BeforeMount = (monaco: Monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: schemaValue
        ? [
            {
              uri: window.location.href,
              fileMatch: ['*'],
              schema: JSON.parse(schemaValue)
            }
          ]
        : undefined,
      enableSchemaRequest: true
    })
  }

  const handleEditorDidMount: OnMount = (
    editor: editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor
    editor.getModel()?.updateOptions({ tabSize: 2 })
    defaultValue && editor.setValue(prettifyJsonString(defaultValue))

    editor.onDidBlurEditorWidget(() => {
      const value = editor.getValue()
      try {
        JSON.parse(value)
        onBlur?.(value, true)
      } catch {
        onBlur?.(value, false)
      }
    })
  }

  // Validation handler
  const handleEditorValidation: OnValidate = (markers: EditorMarker[]) => {
    const errorMessages = markers.map(
      ({ startLineNumber, message }) => `Line ${startLineNumber}: ${message}`
    )
    const hasContent = editorRef.current?.getValue()
    setIsValidJson(!!hasContent && errorMessages.length === 0)
    setErrors(errorMessages)
  }

  const actionGroups: ActionGroup[] = [
    {
      label: 'Basic',
      actions: [
        {
          icon: <RotateCcw className="size-3.5" />,
          label: 'Reset to Default',
          onClick: () => {
            const editor = editorRef.current
            if (!editor) return
            editor.setValue(
              defaultValue ? prettifyJsonString(defaultValue) : ''
            )
          }
        },
        {
          icon: <Trash2 className="size-3.5" />,
          label: 'Clear Editor',
          onClick: () => editorRef.current?.setValue('')
        }
      ]
    },
    {
      label: 'Format',
      actions: [
        {
          icon: <MinusSquare className="size-3.5" />,
          label: 'Minify JSON',
          onClick: () => {
            const editor = editorRef.current
            if (!editor) return
            editor.setValue(minifyJsonString(editor.getValue()))
          },
          disabled: !isValidJson
        },
        {
          icon: <Code className="size-3.5" />,
          label: 'Prettify JSON',
          onClick: () => {
            const editor = editorRef.current
            if (!editor) return
            editor.setValue(prettifyJsonString(editor.getValue()))
          }
        },
        {
          icon: <WrenchIcon className="size-3.5" />,
          label: 'Fix JSON',
          onClick: () => {
            const editor = editorRef.current
            if (!editor) return
            try {
              const value = editor.getValue()
              const fixed = tryFixJson(value)
              editor.setValue(fixed)
            } catch (err) {
              logger.error('Failed to fix JSON:', err)
            }
          },
          disabled: isValidJson
        }
      ]
    },
    {
      label: 'File',
      actions: [
        {
          icon: <Download className="size-3.5" />,
          label: 'Download JSON',
          onClick: () => {
            const value = editorRef.current?.getValue()
            if (value) downloadJsonFile(value)
          },
          disabled: !isValidJson
        },
        {
          icon: <Upload className="size-3.5" />,
          label: 'Upload JSON',
          onClick: () => {},
          isUpload: true,
          onUpload: (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file) return

            const reader = new FileReader()
            reader.onload = e => {
              const content = e.target?.result as string
              editorRef.current?.setValue(prettifyJsonString(content))
            }
            reader.readAsText(file)
          }
        }
      ]
    }
  ]

  return (
    <Card
      className={cn(
        'w-full h-full min-h-[200px] flex flex-col overflow-hidden rounded-md',
        className
      )}
    >
      <CardHeader className="space-y-1.5 p-2 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileJson className="size-4 text-muted-foreground/70" />
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <div className="flex items-center">
            {actionGroups.map((group, groupIndex) => (
              <div key={group.label} className="flex items-center">
                {groupIndex > 0 && (
                  <Separator
                    orientation="vertical"
                    className="mx-2 h-6 bg-border/50"
                  />
                )}
                <div className="flex items-center gap-1" title={group.label}>
                  {group.actions.map(action => (
                    <div key={action.label} className="relative">
                      <ButtonWithTooltip
                        variant="ghost"
                        size="iconXs"
                        tooltip={action.label}
                        side="bottom"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={cn(
                          'hover:bg-muted/80',
                          action.disabled && 'opacity-50'
                        )}
                      >
                        {action.icon}
                      </ButtonWithTooltip>
                      {action.isUpload && (
                        <input
                          type="file"
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          onChange={action.onUpload}
                          accept="application/json"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 relative">
        <div className="absolute inset-0 flex flex-col">
          <Editor
            className="flex-1"
            defaultLanguage="json"
            path={path}
            theme={theme}
            options={{
              placeholder,
              padding: { top: 8, bottom: 8 },
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              renderLineHighlight: 'line',
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              glyphMargin: false,
              folding: true,
              matchBrackets: 'always',
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              formatOnPaste: true,
              formatOnType: true,
              quickSuggestions: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
              }
            }}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
            onChange={onChange}
          />
        </div>
        {errors.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/50">
            <Alert
              variant="destructive"
              className="m-2 py-2 w-[calc(100%-1rem)]"
            >
              <AlertDescription>
                <div className="text-xs space-y-1 text-destructive/90">
                  {errors.map((error: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="rounded-sm bg-destructive/20 px-1 py-0.5 font-mono">
                        {error.match(/Line \d+/)?.[0] ?? 'Error'}
                      </div>
                      <div>{error.replace(/Line \d+: /, '')}</div>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
