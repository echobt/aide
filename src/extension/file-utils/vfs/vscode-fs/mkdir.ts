import type { MakeDirectoryOptions, Mode, NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'

export const mkdir = createIFSMethod<'mkdir'>(
  async (
    path: PathLike,
    optionsOrCallback:
      | MakeDirectoryOptions
      | (MakeDirectoryOptions & { recursive: true })
      | Mode
      | null
      | undefined
      | NoParamCallback,
    callback?: (err: NodeJS.ErrnoException | null, path?: string) => void
  ): Promise<string | void | undefined> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    const operation = async () => {
      const uri = await getUri(path)
      await vscode.workspace.fs.createDirectory(uri)

      // If recursive is true, return the first created directory path
      if (
        optionsOrCallback &&
        typeof optionsOrCallback === 'object' &&
        'recursive' in optionsOrCallback &&
        optionsOrCallback.recursive
      ) {
        return path.toString()
      }

      return undefined
    }

    if (callbackFn) {
      operation()
        .then(path => callbackFn(null, path))
        .catch(callbackFn)
      return
    }

    return operation()
  }
)
