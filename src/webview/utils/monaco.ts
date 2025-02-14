/* eslint-disable new-cap */
import { loader, type Monaco } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const FILE_EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',

  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // JSON & Config
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.yaml': 'yaml',
  '.yml': 'yaml',

  // Markdown
  '.md': 'markdown',
  '.markdown': 'markdown',

  // Python
  '.py': 'python',
  '.pyw': 'python',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',

  // Other
  '.xml': 'xml',
  '.svg': 'xml',
  '.sql': 'sql',
  '.env': 'plaintext',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.csv': 'plaintext',
  '.gitignore': 'plaintext'
}

export const getLanguageFromFileName = (
  fileName: string
): string | undefined => {
  // Handle files without extension
  if (!fileName.includes('.')) {
    return 'plaintext'
  }

  // Get the file extension (including the dot)
  const ext = fileName.slice(fileName.lastIndexOf('.'))

  // Check if we have a mapping for this extension
  return FILE_EXTENSION_TO_LANGUAGE[ext.toLowerCase()]
}

export const initMonaco = async () => {
  // eslint-disable-next-line no-restricted-globals
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    }
  }

  loader.config({ monaco })

  await loader.init()
}

const defaultTsconfig = (
  monaco: Monaco
): monaco.languages.typescript.CompilerOptions => ({
  ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  baseUrl: 'file:///root/',
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  noEmit: true,
  esModuleInterop: true,
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  allowJs: true,
  skipLibCheck: true,
  noImplicitThis: true,
  emitDecoratorMetadata: true,
  resolveJsonModule: true,
  allowSyntheticDefaultImports: true,
  experimentalDecorators: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
  noImplicitAny: false,
  allowUnreachableCode: true,
  allowUnusedLabels: true,
  suppressImplicitAnyIndexErrors: true,
  strict: false,
  typeRoots: ['node_modules/@types']
})

const setDefaults = (
  monaco: Monaco,
  language: monaco.languages.typescript.LanguageServiceDefaults,
  ignoreDiagnosticCodes: number[] = []
) => {
  language.setCompilerOptions(defaultTsconfig(monaco))
  language.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: ignoreDiagnosticCodes
  })
  language.setEagerModelSync(true)
  language.setModeConfiguration({
    completionItems: true,
    codeActions: true
  })
}

export const initTsLanguageSettings = (monaco: Monaco) => {
  const ts = monaco.languages.typescript
  setDefaults(monaco, ts.typescriptDefaults, [6133, 6198, 8006, 8010])
  setDefaults(monaco, ts.javascriptDefaults)
}
