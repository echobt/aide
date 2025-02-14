import { cn } from '@webview/utils/common'

import { CodeEditor } from './code-editor'
import { CodeExplorer } from './code-explorer'

interface CodeProps {
  className?: string
}

export const Code = ({ className }: CodeProps) => (
  <div className={cn('flex h-full', className)}>
    {/* File Explorer */}
    <CodeExplorer className="w-64 border-r bg-muted/50" />

    {/* Editor */}
    <CodeEditor className="flex-1" />
  </div>
)
