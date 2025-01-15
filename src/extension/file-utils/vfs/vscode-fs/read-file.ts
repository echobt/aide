import type { Abortable } from 'events'
import type { ObjectEncodingOptions, PathLike, PathOrFileDescriptor } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const readFile = createIFSMethod<'readFile'>(
  async (
    path: PathLike | PathOrFileDescriptor,
    optionsOrCallback:
      | (ObjectEncodingOptions & {
          encoding?: BufferEncoding | null | undefined
          flag?: string | undefined
        } & Abortable)
      | BufferEncoding
      | ((err: NodeJS.ErrnoException | null, data: Buffer) => void)
      | undefined
      | null,
    callback?: (
      err: NodeJS.ErrnoException | null,
      data: Buffer | string
    ) => void
  ): Promise<string | Buffer | void> => {
    // Handle case where optionsOrCallback is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    const operation = async () => {
      try {
        const uri = await getUri(path)
        const data = await vscode.workspace.fs.readFile(uri)
        const buffer = Buffer.from(data)

        // If no options provided or options is null, return buffer
        if (!optionsOrCallback || optionsOrCallback === null) {
          return buffer
        }

        // Handle string encoding option
        if (typeof optionsOrCallback === 'string') {
          return buffer.toString(optionsOrCallback)
        }

        // Handle object options
        if (typeof optionsOrCallback === 'object') {
          const { encoding } = optionsOrCallback
          if (encoding) {
            return buffer.toString(encoding)
          }
        }

        return buffer
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    // Handle callback style
    if (callbackFn) {
      return operation()
        .then(result => callbackFn(null, result as Buffer))
        .catch(error =>
          callbackFn(error as NodeJS.ErrnoException, Buffer.alloc(0))
        )
    }

    // Handle promise style
    return operation()
  }
)
