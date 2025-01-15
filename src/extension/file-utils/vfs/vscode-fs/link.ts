import type { NoParamCallback, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'

export const link = createIFSMethod<'link'>(
  async (
    existingPath: PathLike,
    newPath: PathLike,
    callback: NoParamCallback
  ): Promise<void> => {
    const operation = async () => {
      const sourceUri = await getUri(existingPath)
      const targetUri = await getUri(newPath)

      // Read source file content
      const content = await vscode.workspace.fs.readFile(sourceUri)

      // Write to target path
      await vscode.workspace.fs.writeFile(targetUri, content)
    }

    if (callback) {
      operation()
        .then(() => callback(null))
        .catch(callback)
      return
    }

    return operation()
  }
)
