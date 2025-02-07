import type { NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const symlink = createIFSMethod<'symlink'>(
  async (
    target: PathLike,
    path: PathLike,
    typeOrCallback?: string | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    // Handle case where type is the callback
    const callbackFn =
      typeof typeOrCallback === 'function' ? typeOrCallback : callback

    const operation = async () => {
      try {
        const targetUri = await getUri(target)
        const pathUri = await getUri(path)

        // Read target file content
        const content = await vscode.workspace.fs.readFile(targetUri)

        // Create symbolic link by copying the content
        // Note: VSCode API doesn't support true symbolic links,
        // so we create a copy of the file instead
        await vscode.workspace.fs.writeFile(pathUri, content)
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callbackFn) {
      operation()
        .then(() => callbackFn(null))
        .catch(error => callbackFn(error as NodeJS.ErrnoException))
      return
    }

    return operation()
  }
)
