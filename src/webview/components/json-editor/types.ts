import type { MarkerSeverity } from 'monaco-editor/esm/vs/editor/editor.api'

export interface EditorMarker {
  severity: MarkerSeverity
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}
