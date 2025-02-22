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
import {
  downloadJsonFile,
  minifyJsonString,
  prettifyJsonString
} from './helper/utils'
import { tryFixJson } from './helper/validation'
import type { EditorMarker } from './types'

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

  // Editor actions
  const handleClear = () => editorRef.current?.setValue('')

  const handlePrettify = () => {
    const editor = editorRef.current
    if (!editor) return
    const value = editor.getValue()
    editor.setValue(prettifyJsonString(value))
  }

  const handleMinify = () => {
    const editor = editorRef.current
    if (!editor) return
    const value = editor.getValue()
    editor.setValue(minifyJsonString(value))
  }

  const handleDownload = () => {
    const value = editorRef.current?.getValue()
    if (value) downloadJsonFile(value)
  }

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      editorRef.current?.setValue(prettifyJsonString(content))
    }
    reader.readAsText(file)
  }

  const handleFix = () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const value = editor.getValue()
      const fixed = tryFixJson(value)
      editor.setValue(fixed)
    } catch (err) {
      logger.error('Failed to fix JSON:', err)
    }
  }

  // Remove undo/redo handlers and add reset handler
  const handleReset = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.setValue(defaultValue ? prettifyJsonString(defaultValue) : '')
  }

  return (
    <Card
      className={cn(
        'w-full h-full min-h-[200px] flex flex-col overflow-hidden',
        className
      )}
    >
      <CardHeader className="space-y-1.5 p-2">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center space-x-2">
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Reset to Default"
              side="bottom"
              onClick={handleReset}
            >
              <RotateCcw className="size-3" />
            </ButtonWithTooltip>

            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Clear"
              side="bottom"
              onClick={handleClear}
            >
              <Trash2 className="size-3" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Minify"
              side="bottom"
              onClick={handleMinify}
              disabled={!isValidJson}
            >
              <MinusSquare className="size-3" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Prettify"
              side="bottom"
              onClick={handlePrettify}
            >
              <Code className="size-3" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Fix JSON"
              side="bottom"
              onClick={handleFix}
              disabled={isValidJson}
            >
              <WrenchIcon className="size-3" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="Download"
              side="bottom"
              onClick={handleDownload}
              disabled={!isValidJson}
            >
              <Download className="size-3" />
            </ButtonWithTooltip>
            <div className="relative">
              <ButtonWithTooltip
                variant="ghost"
                size="iconXs"
                tooltip="Upload"
                side="bottom"
                className="relative"
              >
                <Upload className="size-3" />
                <input
                  type="file"
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  onChange={handleUpload}
                  accept="application/json"
                />
              </ButtonWithTooltip>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <div className="relative flex-1 flex flex-col">
          <Editor
            className="flex-1"
            wrapperProps={{
              className: 'flex-1'
            }}
            defaultLanguage="json"
            path={path}
            theme={theme}
            options={{
              placeholder,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              formatOnPaste: true,
              formatOnType: true,
              quickSuggestions: true,
              folding: true,
              matchBrackets: 'always',
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always'
            }}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
            onChange={onChange}
          />
        </div>
        {errors.length > 0 && (
          <Alert variant="destructive" className="mt-2 shrink-0">
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm text-destructive">
                {errors.map((error: string, i: number) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
