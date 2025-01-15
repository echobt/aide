import type {
  NoParamCallback,
  PathOrFileDescriptor,
  WriteFileOptions
} from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const appendFile = createIFSMethod<'appendFile'>(
  async (
    path: PathOrFileDescriptor,
    data: string | Uint8Array,
    optionsOrCallback?: WriteFileOptions | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    const operation = async () => {
      try {
        const uri = await getUri(path)
        let existingData: Uint8Array
        try {
          existingData = await vscode.workspace.fs.readFile(uri)
        } catch {
          existingData = new Uint8Array()
        }

        const appendData = typeof data === 'string' ? Buffer.from(data) : data

        const newData = new Uint8Array([...existingData, ...appendData])
        await vscode.workspace.fs.writeFile(uri, newData)
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
