import type { PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

// Overloaded function types to match Node.js fs API
type ReadlinkCallbackBuffer = (
  err: NodeJS.ErrnoException | null,
  linkString: Buffer
) => void
type ReadlinkCallbackString = (
  err: NodeJS.ErrnoException | null,
  linkString: string
) => void

type BufferEncodingOption = {
  encoding: 'buffer'
}

type StringEncodingOption = {
  encoding?: BufferEncoding | null | undefined
}

type EncodingOption =
  | StringEncodingOption
  | BufferEncoding
  | null
  | undefined
  | BufferEncodingOption
  | 'buffer'

const isBufferEncoding = (opt: any): opt is BufferEncodingOption | 'buffer' =>
  opt === 'buffer' ||
  (typeof opt === 'object' &&
    opt !== null &&
    'encoding' in opt &&
    opt.encoding === 'buffer')

export const readlink = createIFSMethod<'readlink'>(
  async (
    path: PathLike,
    optionsOrCallback?: EncodingOption | ReadlinkCallbackString,
    callback?: ReadlinkCallbackString | ReadlinkCallbackBuffer
  ): Promise<string | Buffer | void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function'
        ? (optionsOrCallback as ReadlinkCallbackString)
        : callback

    const operation = async () => {
      try {
        const uri = await getUri(path)
        const stat = await vscode.workspace.fs.stat(uri)

        if (!(stat.type & vscode.FileType.SymbolicLink)) {
          throw new Error('EINVAL: invalid argument, readlink')
        }

        // VSCode API does not support reading the target of a symbolic link directly
        // so return the actual path
        const linkPath = uri.fsPath

        // Handle buffer encoding
        if (isBufferEncoding(optionsOrCallback)) {
          return Buffer.from(linkPath)
        }

        // Handle string encoding or default case
        if (typeof optionsOrCallback === 'string') {
          return Buffer.from(linkPath).toString(optionsOrCallback)
        }

        if (
          optionsOrCallback &&
          typeof optionsOrCallback === 'object' &&
          'encoding' in optionsOrCallback &&
          optionsOrCallback.encoding
        ) {
          return Buffer.from(linkPath).toString(optionsOrCallback.encoding)
        }

        return linkPath
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callbackFn) {
      operation()
        .then(result => {
          if (isBufferEncoding(optionsOrCallback)) {
            ;(callbackFn as ReadlinkCallbackBuffer)(null, result as Buffer)
          } else {
            ;(callbackFn as ReadlinkCallbackString)(null, result as string)
          }
        })
        .catch(error => {
          const mappedError = mapVSCodeError(error)
          if (isBufferEncoding(optionsOrCallback)) {
            ;(callbackFn as ReadlinkCallbackBuffer)(
              mappedError,
              Buffer.alloc(0)
            )
          } else {
            ;(callbackFn as ReadlinkCallbackString)(mappedError, '')
          }
        })
      return
    }

    return operation()
  }
)
