import type {
  NoParamCallback,
  PathOrFileDescriptor,
  WriteFileOptions
} from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { FILE_FLAGS, validateFd, type FileFlag } from './_helpers'

export const writeFile = createIFSMethod<'writeFile'>(
  async (
    path: PathOrFileDescriptor,
    data: string | NodeJS.ArrayBufferView,
    optionsOrCallback?: WriteFileOptions | NoParamCallback,
    callback?: NoParamCallback
  ): Promise<void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback
    const options =
      typeof optionsOrCallback === 'object' && optionsOrCallback !== null
        ? optionsOrCallback
        : {}

    const operation = async () => {
      // Handle AbortSignal
      if (options.signal?.aborted) {
        throw new Error('The operation was aborted')
      }

      let uri: vscode.Uri

      // Handle file descriptor
      if (typeof path === 'number') {
        const fdInfo = validateFd(path)
        uri = fdInfo.uri
      } else {
        uri = await getUri(path)
      }

      // Convert data to Buffer
      let buffer: Buffer
      if (Buffer.isBuffer(data)) {
        buffer = data
      } else if (ArrayBuffer.isView(data)) {
        buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      } else {
        const encoding =
          typeof options === 'string' ? options : options.encoding || 'utf-8'
        buffer = Buffer.from(data, encoding as BufferEncoding)
      }

      const flag = (options.flag || 'w') as FileFlag
      const flagInfo = FILE_FLAGS[flag]

      if (!flagInfo) {
        throw new Error(`Unsupported file flag: ${flag}`)
      }

      // Check if file exists for exclusive flags
      if (flagInfo.exclusive) {
        try {
          await vscode.workspace.fs.stat(uri)
          throw new Error('EEXIST: file already exists, write')
        } catch (error) {
          if (error instanceof Error && error.message.includes('EEXIST')) {
            throw error
          }
          // File doesn't exist, which is what we want for exclusive flags
        }
      }

      // Handle append flag
      if (flagInfo.append) {
        try {
          const existingData = await vscode.workspace.fs.readFile(uri)
          buffer = Buffer.concat([existingData, buffer])
        } catch {
          // File doesn't exist, just write the new data
        }
      }

      // Write file
      await vscode.workspace.fs.writeFile(uri, buffer)

      // Handle mode (permissions)
      if (options.mode !== undefined) {
        // VSCode API doesn't support changing file permissions
        // This is a no-op in VSCode environment
      }

      // Handle flush option
      if (options.flush) {
        try {
          // VSCode doesn't have direct flush support, but we can try to ensure data is written
          await vscode.workspace.fs.stat(uri)
        } catch (error) {
          // Ignore stat errors after write
        }
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
