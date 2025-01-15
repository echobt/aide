import { constants, type NoParamCallback, type PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const access = createIFSMethod<'access'>(
  async (
    path: PathLike,
    modeOrCallback?: number | undefined | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    const callbackFn =
      typeof modeOrCallback === 'function' ? modeOrCallback : callback
    const mode =
      typeof modeOrCallback === 'number' ? modeOrCallback : constants.F_OK

    const operation = async () => {
      try {
        const uri = await getUri(path)

        // Check if file exists (F_OK)
        if (!mode || mode === constants.F_OK) {
          await vscode.workspace.fs.stat(uri)
          return
        }

        // Check read permission (R_OK)
        if (mode & constants.R_OK) {
          await vscode.workspace.fs.readFile(uri)
        }

        // Check write permission (W_OK)
        // if (mode & constants.W_OK) {
        //   const testData = new Uint8Array(0)
        //   await vscode.workspace.fs.writeFile(uri, testData)
        // }

        // X_OK not supported in VSCode fs, treat as success
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callback) {
      operation()
        .then(() => callbackFn?.(null))
        .catch(callbackFn)
      return
    }

    return operation()
  }
)
