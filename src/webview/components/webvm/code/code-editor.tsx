import { Fragment, useRef } from 'react'
import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator
} from '@webview/components/ui/breadcrumb'
import { Button } from '@webview/components/ui/button'
import { useGlobalContext } from '@webview/contexts/global-context'
import { cn } from '@webview/utils/common'
import {
  getLanguageFromFileName,
  initTsLanguageSettings
} from '@webview/utils/monaco'
import { motion } from 'framer-motion'
import { ChevronsLeft, Copy, GitCompare } from 'lucide-react'
import { editor } from 'monaco-editor'

import { useCodeEditorContext } from './context/code-editor-context'
import { useCodeExplorerContext } from './context/code-explorer-context'

interface CodeEditorProps {
  className?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export const CodeEditor = ({
  className,
  isCollapsed = false,
  onToggleCollapse
}: CodeEditorProps) => {
  const { activeFile, readonly } = useCodeExplorerContext()
  const { isDarkTheme } = useGlobalContext()
  const {
    handleCopyFileContent,
    showDiff,
    toggleDiff,
    hasDiff,
    originalFileContent,
    handleContentChange
  } = useCodeEditorContext()
  const monacoRef = useRef<Monaco | null>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)
    initTsLanguageSettings(monaco)
    monacoRef.current = monaco
  }

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    monacoRef.current = monaco
    editorRef.current = editor
  }

  const handleDiffEditorDidMount = (
    editor: editor.IStandaloneDiffEditor,
    monaco: Monaco
  ) => {
    monacoRef.current = monaco
    diffEditorRef.current = editor
  }

  // Add language detection
  const getFileLanguage = (filePath: string) => {
    const language = getLanguageFromFileName(filePath)
    return language || 'plaintext'
  }

  const language = getFileLanguage(activeFile?.path || '')
  const theme = isDarkTheme ? 'vs-dark' : 'vs-light'

  if (!activeFile) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <span className="text-muted-foreground">Select a file to edit</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="iconXs"
            className="shrink-0"
            onClick={onToggleCollapse}
          >
            <motion.div
              initial={false}
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronsLeft className="size-3" />
            </motion.div>
          </Button>

          <Breadcrumb>
            <BreadcrumbList className="!gap-0.5">
              {activeFile.path.split('/').map((part, index) => (
                <Fragment key={part}>
                  {index !== 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>{part}</BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          {hasDiff && (
            <Button variant="ghost" size="iconXs" onClick={toggleDiff}>
              <GitCompare className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="iconXs" onClick={handleCopyFileContent}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showDiff ? (
        <DiffEditor
          height="100%"
          original={originalFileContent}
          modified={activeFile.content}
          language={language}
          beforeMount={handleEditorWillMount}
          onMount={handleDiffEditorDidMount}
          theme={theme}
          options={{
            readOnly: true,
            minimap: { enabled: true, size: 'proportional' },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on'
          }}
          className="flex-1"
        />
      ) : (
        <Editor
          height="100%"
          value={activeFile.content}
          language={language}
          onChange={handleContentChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme={theme}
          options={{
            readOnly: readonly,
            minimap: { enabled: true, size: 'proportional' },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on'
          }}
          className="flex-1"
        />
      )}
    </div>
  )
}
