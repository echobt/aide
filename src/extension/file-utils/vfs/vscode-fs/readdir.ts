import { Dirent, type PathLike } from 'fs'
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
        const options =
          typeof optionsOrCallback === 'object' ? optionsOrCallback : {}

        // Implement recursive directory traversal
        const readEntries = async (
          currentUri: vscode.Uri
        ): Promise<[string, vscode.FileType][]> => {
          const entries = await vscode.workspace.fs.readDirectory(currentUri)
          let results = entries

          if (options?.recursive) {
            for (const [name, type] of entries) {
              if (type === vscode.FileType.Directory) {
                const subDirUri = vscode.Uri.joinPath(currentUri, name)
                const subEntries = await readEntries(subDirUri)
                results = results.concat(
                  subEntries.map(
                    ([subName, subType]) =>
                      [`${name}/${subName}`, subType] as [
                        string,
                        vscode.FileType
                      ]
                  )
                )
              }
            }
          }
          return results
        }

        const entries = await readEntries(uri)

        // Create proper Dirent instances
        if (options?.withFileTypes) {
          return entries.map(
            ([name, type]) =>
              new (class extends Dirent {
                constructor() {
                  super()
                  this.name = name
                  this.path = path.toString()
                }

                isBlockDevice() {
                  return false
                }

                isCharacterDevice() {
                  return false
                }

                isFIFO() {
                  return false
                }

                isSocket() {
                  return false
                }

                isSymbolicLink() {
                  return type === vscode.FileType.SymbolicLink
                }

                isFile() {
                  return type === vscode.FileType.File
                }

                isDirectory() {
                  return type === vscode.FileType.Directory
                }
              })()
          )
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
