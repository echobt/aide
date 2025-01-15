import type { NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const unlink = createIFSMethod<'unlink'>(
  async (path: PathLike, callback?: NoParamCallback): Promise<void> => {
    const operation = async () => {
      const uri = await getUri(path)

      try {
        const stat = await vscode.workspace.fs.stat(uri)
        if (stat.type === vscode.FileType.Directory) {
          throw new Error('EISDIR: illegal operation on a directory, unlink')
        }
        await vscode.workspace.fs.delete(uri, { recursive: true })
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
