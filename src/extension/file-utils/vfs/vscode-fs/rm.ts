import type { NoParamCallback, PathLike, RmOptions } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const rm = createIFSMethod<'rm'>(
  async (
    path: PathLike,
    optionsOrCallback?: RmOptions | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    const options =
      typeof optionsOrCallback === 'object' ? optionsOrCallback : {}

    const operation = async () => {
      try {
        const uri = await getUri(path)

        // Check if path exists
        try {
          await vscode.workspace.fs.stat(uri)
        } catch (error) {
          // If force option is true, ignore ENOENT errors
          if (options.force) {
            return
          }
          throw error
        }

        // Handle retries for recursive deletion
        const maxRetries = options.maxRetries || 0
        const retryDelay = options.retryDelay || 100

        let lastError: Error | null = null
        for (let i = 0; i <= maxRetries; i++) {
          try {
            await vscode.workspace.fs.delete(uri, {
              recursive: options.recursive || false
            })
            return
          } catch (error) {
            lastError = error as Error
            if (i < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
            }
          }
        }

        if (lastError) {
          throw mapVSCodeError(lastError)
        }
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
