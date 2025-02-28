import * as path from 'path'
import { getErrorMsg, isAbortError } from '@shared/utils/common'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { logger } from './logger'
import { getServerState, setServerState } from './state'

export const getIsDev = () => {
  const { context } = getServerState()
  if (!context) return false
  return context.extensionMode !== vscode.ExtensionMode.Production
}

export const getCanUpdatePkgJson = (): boolean =>
  __UPDATE_PKG_JSON__ === 'enable'

export const getOrCreateTerminal = async (
  name: string,
  cwd: string
): Promise<vscode.Terminal> => {
  let terminal = vscode.window.terminals.find(t => t.name === name)
  if (!terminal || terminal.exitStatus) {
    terminal = vscode.window.createTerminal({ name, cwd })
  }
  return terminal
}

export const executeCommand = async (
  command: string,
  cwd: string
): Promise<void> => {
  const terminal = await getOrCreateTerminal('aide', cwd)
  terminal.show(true)
  terminal.sendText(command)
}

export const runWithCathError = async <T extends () => any>(
  fn: T,
  logLabel = 'runWithCathError'
): Promise<ReturnType<T> | void> => {
  try {
    return await fn()
  } catch (err) {
    if (isAbortError(err)) return

    logger.warn(logLabel, err)
    vscode.window.showErrorMessage(getErrorMsg(err))
  }
}

export const commandWithCatcher = <T extends (...args: any[]) => any>(
  commandFn: T
): T =>
  (async (...args: any[]) =>
    await runWithCathError(() => commandFn(...args))) as T

export const getWorkspaceFolder = <T extends boolean = true>(
  throwErrorWhenNotFound: T = true as T
): T extends true
  ? vscode.WorkspaceFolder
  : vscode.WorkspaceFolder | undefined => {
  const activeEditor = vscode.window.activeTextEditor

  if (activeEditor) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      activeEditor.document.uri
    )
    if (workspaceFolder) {
      setServerState({ lastWorkspaceFolder: workspaceFolder })
      return workspaceFolder
    }
  }

  if (getServerState().lastWorkspaceFolder) {
    return getServerState().lastWorkspaceFolder!
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]

  if (workspaceFolder) {
    setServerState({ lastWorkspaceFolder: workspaceFolder })
    return workspaceFolder
  }

  if (throwErrorWhenNotFound) throw new Error(t('extension.error.noWorkspace'))

  return undefined as any
}

export const getActiveEditor = (): vscode.TextEditor => {
  const activeEditor = vscode.window.activeTextEditor

  if (!activeEditor) throw new Error(t('extension.error.noActiveEditor'))

  return activeEditor
}

export const formatNumber = (num: number, fixed: number): string => {
  const numString = num.toFixed(fixed)
  return numString.replace(/\.?0+$/, '')
}

export const removeCodeBlockSyntax = (str: string): string => {
  if (!str) return ''
  return str
    .trim()
    .replace(/^\s*```[\s\S]*?\n([\s\S]*?)\n```\s*$/g, '$1')
    .trim()
}

export const removeCodeBlockStartSyntax = (str: string): string => {
  if (!str) return ''
  return str.replace(/^\s*```[\s\S]*?\n/, '')
}

export const removeCodeBlockEndSyntax = (str: string): string => {
  if (!str) return ''
  return str.replace(/\n```\s*$/g, '')
}

export const toPlatformPath = (path: string): string => {
  if (process.platform === 'win32') return path.replace(/\//g, '\\')

  return path.replace(/\\/g, '/')
}

export const normalizeLineEndings = (text?: string): string => {
  if (!text) return ''

  const activeEditor = vscode.window.activeTextEditor
  if (!activeEditor) return text

  const { eol } = activeEditor.document

  // convert all EOL to LF
  const unifiedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // replace with target EOL
  if (eol === vscode.EndOfLine.LF) return unifiedText
  if (eol === vscode.EndOfLine.CRLF) return unifiedText.replace(/\n/g, '\r\n')

  return text
}

type QuickPickItemType = string | vscode.QuickPickItem

export interface QuickPickOptions {
  items: QuickPickItemType[]
  placeholder: string
  customOption?: string
}

export const showQuickPickWithCustomInput = async (
  options: QuickPickOptions
): Promise<string> => {
  const quickPick = vscode.window.createQuickPick()

  quickPick.items = options.items.map(item =>
    typeof item === 'string' ? { label: item } : item
  )

  quickPick.placeholder = options.placeholder

  if (options.customOption) {
    quickPick.items = [{ label: options.customOption }, ...quickPick.items]
  }

  return new Promise<string>(resolve => {
    quickPick.onDidAccept(() => {
      const selection = quickPick.selectedItems[0]
      if (selection) {
        resolve(selection.label)
      } else {
        resolve(quickPick.value)
      }
      quickPick.hide()
    })

    quickPick.onDidHide(() => {
      resolve('')
      quickPick.dispose()
    })

    quickPick.show()
  })
}

export type VSCodeRangeJson = [
  {
    line: number
    character: number
  },
  {
    line: number
    character: number
  }
]

export const convertRangeJsonToVSCodeRange = (
  range: VSCodeRangeJson | vscode.Range
): vscode.Range => {
  if (Array.isArray(range)) {
    return new vscode.Range(
      range[0].line,
      range[0].character,
      range[1].line,
      range[1].character
    )
  }
  return range
}

export type VSCodeUriJson = {
  $mid: number
  external: string
  path: string
  scheme: string
}

export const convertUriJsonToVSCodeUri = (
  uri: VSCodeUriJson | vscode.Uri
): vscode.Uri => {
  if (uri instanceof vscode.Uri) return uri
  return vscode.Uri.from({
    scheme: uri.scheme,
    path: uri.path
  })
}

export const getExtensionUnpackedDir = () => {
  const { context } = getServerState()
  if (!context) throw new Error(t('extension.error.noContext'))
  return path.resolve(context.extensionUri.fsPath)
}

export const getDistDir = () => {
  const unpackedDir = getExtensionUnpackedDir()
  return path.resolve(unpackedDir, 'dist')
}

// export const extensionDistDir =
//   typeof __dirname === 'string'
//     ? __dirname
//     : dirname(fileURLToPath(import.meta.url))
