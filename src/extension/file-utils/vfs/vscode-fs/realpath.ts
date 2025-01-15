import type { PathLike } from 'fs'

import { createIFSMethod, getUri } from '../helpers/utils'

// Overloaded function types to match Node.js fs API
type RealpathCallbackBuffer = (
  err: NodeJS.ErrnoException | null,
  resolvedPath: Buffer
) => void
type RealpathCallbackString = (
  err: NodeJS.ErrnoException | null,
  resolvedPath: string
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

export const realpath = createIFSMethod<'realpath'>(
  async (
    path: PathLike,
    optionsOrCallback?: EncodingOption | RealpathCallbackString,
    callback?: RealpathCallbackString | RealpathCallbackBuffer
  ): Promise<string | Buffer | void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function'
        ? (optionsOrCallback as RealpathCallbackString)
        : callback

    const operation = async () => {
      const uri = await getUri(path)
      const resolvedPath = uri.fsPath

      // Handle buffer encoding
      if (isBufferEncoding(optionsOrCallback)) {
        return Buffer.from(resolvedPath)
      }

      // Handle string encoding or default case
      if (typeof optionsOrCallback === 'string') {
        return Buffer.from(resolvedPath).toString(optionsOrCallback)
      }

      if (
        optionsOrCallback &&
        typeof optionsOrCallback === 'object' &&
        'encoding' in optionsOrCallback &&
        optionsOrCallback.encoding
      ) {
        return Buffer.from(resolvedPath).toString(optionsOrCallback.encoding)
      }

      return resolvedPath
    }

    if (callbackFn) {
      operation()
        .then(result => {
          if (isBufferEncoding(optionsOrCallback)) {
            ;(callbackFn as RealpathCallbackBuffer)(null, result as Buffer)
          } else {
            ;(callbackFn as RealpathCallbackString)(null, result as string)
          }
        })
        .catch(error => {
          if (isBufferEncoding(optionsOrCallback)) {
            ;(callbackFn as RealpathCallbackBuffer)(
              error as NodeJS.ErrnoException,
              Buffer.alloc(0)
            )
          } else {
            ;(callbackFn as RealpathCallbackString)(
              error as NodeJS.ErrnoException,
              ''
            )
          }
        })
      return
    }

    return operation()
  }
)

// Add native implementation (same as the default implementation)
realpath.native = realpath
