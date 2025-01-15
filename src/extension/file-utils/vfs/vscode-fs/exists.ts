import type { PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'

export const exists = createIFSMethod<'exists'>(
  async (
    path: PathLike,
    callback: (exists: boolean) => void
  ): Promise<boolean | void> => {
    const operation = async () => {
      try {
        const uri = await getUri(path)
        await vscode.workspace.fs.stat(uri)
        return true
      } catch {
        return false
      }
    }

    if (callback) {
      operation().then(callback)
      return
    }

    return operation()
  }
)
