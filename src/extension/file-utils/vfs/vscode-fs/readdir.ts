import type { Dirent, PathLike } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

// Overloaded function types to match Node.js fs API
type ReaddirCallbackWithFileTypes = (
  err: NodeJS.ErrnoException | null,
  files: Dirent[]
) => void
type ReaddirCallbackBuffer = (
  err: NodeJS.ErrnoException | null,
  files: Buffer[]
) => void
type ReaddirCallbackString = (
  err: NodeJS.ErrnoException | null,
  files: string[]
) => void

export const readdir = createIFSMethod<'readdir'>(
  async (
    path: PathLike,
    optionsOrCallback?:
      | {
          encoding?: BufferEncoding | 'buffer' | null
          withFileTypes?: boolean | undefined
          recursive?: boolean | undefined
        }
      | string
      | ReaddirCallbackString
      | undefined
      | null,
    callback?:
      | ReaddirCallbackString
      | ReaddirCallbackBuffer
      | ReaddirCallbackWithFileTypes
  ): Promise<string[] | Buffer[] | Dirent[] | void> => {
    // Handle case where options is the callback
    const callbackFn =
      typeof optionsOrCallback === 'function'
        ? (optionsOrCallback as ReaddirCallbackString)
        : callback

    const operation = async () => {
      try {
        const uri = await getUri(path)
        const entries = await vscode.workspace.fs.readDirectory(uri)

        // Handle withFileTypes option
        if (
          optionsOrCallback &&
          typeof optionsOrCallback === 'object' &&
          'withFileTypes' in optionsOrCallback &&
          optionsOrCallback.withFileTypes
        ) {
          return entries.map(([name, type]) => {
            const dirent = {
              name,
              isFile: () => type === vscode.FileType.File,
              isDirectory: () => type === vscode.FileType.Directory,
              isSymbolicLink: () => type === vscode.FileType.SymbolicLink,
              isBlockDevice: () => false,
              isCharacterDevice: () => false,
              isFIFO: () => false,
              isSocket: () => false,
              path: path.toString(),
              parentPath: path.toString()
            } as Dirent

            return dirent
          })
        }

        // Handle buffer encoding
        if (
          optionsOrCallback === 'buffer' ||
          (optionsOrCallback &&
            typeof optionsOrCallback === 'object' &&
            'encoding' in optionsOrCallback &&
            optionsOrCallback.encoding === 'buffer')
        ) {
          return entries.map(([name]) => Buffer.from(name))
        }

        // Handle string encoding or default case
        return entries.map(([name]) => name)
      } catch (error) {
        throw mapVSCodeError(error)
      }
    }

    if (callbackFn) {
      operation()
        .then(files => {
          if (
            optionsOrCallback &&
            typeof optionsOrCallback === 'object' &&
            'withFileTypes' in optionsOrCallback &&
            optionsOrCallback.withFileTypes
          ) {
            ;(callbackFn as ReaddirCallbackWithFileTypes)(
              null,
              files as Dirent[]
            )
          } else if (
            optionsOrCallback === 'buffer' ||
            (optionsOrCallback &&
              typeof optionsOrCallback === 'object' &&
              'encoding' in optionsOrCallback &&
              optionsOrCallback.encoding === 'buffer')
          ) {
            ;(callbackFn as ReaddirCallbackBuffer)(null, files as Buffer[])
          } else {
            ;(callbackFn as ReaddirCallbackString)(null, files as string[])
          }
        })
        .catch(error => callbackFn(mapVSCodeError(error), []))
      return
    }

    return operation()
  }
)
