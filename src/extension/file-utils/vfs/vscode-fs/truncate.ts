import type { NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const truncate = createIFSMethod<'truncate'>(
  async (
    path: PathLike,
    lenOrCallback?: number | null | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    // Handle case where len is the callback
    const callbackFn =
      typeof lenOrCallback === 'function' ? lenOrCallback : callback
    const len =
      typeof lenOrCallback === 'number' || lenOrCallback === null
        ? (lenOrCallback ?? 0)
        : 0

    const operation = async () => {
      try {
        const uri = await getUri(path)
        const stat = await vscode.workspace.fs.stat(uri)
        if (!(stat.type & vscode.FileType.File)) {
          throw new Error('EISDIR: illegal operation on a directory, truncate')
        }

        // Read existing file
        const data = await vscode.workspace.fs.readFile(uri)

        // Handle negative length
        const finalLen = len < 0 ? 0 : len

        // Create truncated buffer
        let truncated: Uint8Array
        if (finalLen > data.length) {
          // If len is greater than file size, extend with zeros
          truncated = new Uint8Array(finalLen)
          truncated.set(data)
        } else {
          // Otherwise slice to len
          truncated = data.slice(0, finalLen)
        }

        // Write back to file
        await vscode.workspace.fs.writeFile(uri, truncated)
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callbackFn) {
      operation()
        .then(() => callbackFn(null))
        .catch(callbackFn)
      return
    }

    return operation()
  }
)
