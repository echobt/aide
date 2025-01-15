import type { NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const rename = createIFSMethod<'rename'>(
  async (
    oldPath: PathLike,
    newPath: PathLike,
    callback?: NoParamCallback
  ): Promise<void> => {
    const operation = async () => {
      const oldUri = await getUri(oldPath)
      const newUri = await getUri(newPath)

      try {
        await vscode.workspace.fs.stat(oldUri)
        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false })
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callback) {
      operation()
        .then(() => callback(null))
        .catch(error => callback(error as NodeJS.ErrnoException))
      return
    }

    return operation()
  }
)
