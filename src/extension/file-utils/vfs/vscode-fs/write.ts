import * as vscode from 'vscode'

import { createIFSMethod } from '../helpers/utils'
import { validateFd } from './_helpers'

type WriteStringCallback = (
  err: NodeJS.ErrnoException | null,
  written: number,
  str: string
) => void

type WriteBufferCallback = (
  err: NodeJS.ErrnoException | null,
  written: number,
  buffer: NodeJS.ArrayBufferView
) => void

type WriteResult = {
  bytesWritten: number
  buffer: NodeJS.ArrayBufferView | string
}

export const write = createIFSMethod<'write'>(
  async (
    fd: number,
    bufferOrString: NodeJS.ArrayBufferView | string,
    offsetOrPositionOrCallback?:
      | number
      | null
      | WriteStringCallback
      | WriteBufferCallback,
    lengthOrEncodingOrCallback?:
      | number
      | null
      | BufferEncoding
      | WriteStringCallback
      | WriteBufferCallback,
    positionOrCallback?:
      | number
      | null
      | WriteStringCallback
      | WriteBufferCallback,
    callback?: WriteStringCallback | WriteBufferCallback
  ): Promise<WriteResult | number> => {
    // Handle different parameter combinations
    let offset = 0
    let length: number | undefined
    let position: number | null = null
    let encoding: BufferEncoding | undefined
    let callbackFn: WriteStringCallback | WriteBufferCallback | undefined

    // Case 1: write(fd, string[, position[, encoding]], callback)
    if (typeof bufferOrString === 'string') {
      position =
        typeof offsetOrPositionOrCallback === 'number'
          ? offsetOrPositionOrCallback
          : null
      encoding =
        typeof lengthOrEncodingOrCallback === 'string'
          ? lengthOrEncodingOrCallback
          : undefined
      callbackFn =
        typeof offsetOrPositionOrCallback === 'function'
          ? (offsetOrPositionOrCallback as WriteStringCallback)
          : typeof lengthOrEncodingOrCallback === 'function'
            ? (lengthOrEncodingOrCallback as WriteStringCallback)
            : typeof positionOrCallback === 'function'
              ? (positionOrCallback as WriteStringCallback)
              : (callback as WriteStringCallback)
    }
    // Case 2: write(fd, buffer[, offset[, length[, position]]], callback)
    else {
      offset =
        typeof offsetOrPositionOrCallback === 'number'
          ? offsetOrPositionOrCallback
          : 0
      length =
        typeof lengthOrEncodingOrCallback === 'number'
          ? lengthOrEncodingOrCallback
          : undefined
      position =
        typeof positionOrCallback === 'number' ? positionOrCallback : null
      callbackFn =
        typeof offsetOrPositionOrCallback === 'function'
          ? (offsetOrPositionOrCallback as WriteBufferCallback)
          : typeof lengthOrEncodingOrCallback === 'function'
            ? (lengthOrEncodingOrCallback as WriteBufferCallback)
            : typeof positionOrCallback === 'function'
              ? (positionOrCallback as WriteBufferCallback)
              : (callback as WriteBufferCallback)
    }

    const operation = async () => {
      const fdInfo = validateFd(fd)

      // Read existing file content
      const existingData = await vscode.workspace.fs.readFile(fdInfo.uri)

      // Prepare data to write
      let writeData: Uint8Array
      if (typeof bufferOrString === 'string') {
        // Handle string write
        const buffer = Buffer.from(bufferOrString, encoding)
        writeData = buffer
      } else {
        // Handle buffer write
        const buffer = Buffer.from(
          bufferOrString.buffer,
          bufferOrString.byteOffset,
          bufferOrString.byteLength
        )
        const writeLength = length ?? buffer.length - offset
        writeData = buffer.subarray(offset, offset + writeLength)
      }

      // Calculate write position
      const writePosition = position ?? fdInfo.position

      // Create new file content
      const newData = new Uint8Array(
        Math.max(existingData.length, writePosition + writeData.length)
      )
      newData.set(existingData)
      newData.set(writeData, writePosition)

      // Write to file
      await vscode.workspace.fs.writeFile(fdInfo.uri, newData)

      // Update file position
      fdInfo.position = writePosition + writeData.length

      return {
        bytesWritten: writeData.length,
        buffer: bufferOrString
      }
    }

    if (callbackFn) {
      operation()
        .then(result => {
          if (typeof bufferOrString === 'string') {
            ;(callbackFn as WriteStringCallback)(
              null,
              result.bytesWritten,
              result.buffer as string
            )
          } else {
            ;(callbackFn as WriteBufferCallback)(
              null,
              result.bytesWritten,
              result.buffer as NodeJS.ArrayBufferView
            )
          }
        })
        .catch(error => {
          if (typeof bufferOrString === 'string') {
            ;(callbackFn as WriteStringCallback)(
              error as NodeJS.ErrnoException,
              0,
              bufferOrString
            )
          } else {
            ;(callbackFn as WriteBufferCallback)(
              error as NodeJS.ErrnoException,
              0,
              bufferOrString
            )
          }
        })
      return 0
    }

    const result = await operation()
    return result.bytesWritten
  }
)
