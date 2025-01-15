import type { ReadAsyncOptions, ReadPosition } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod } from '../helpers/utils'
import { validateFd } from './_helpers'

type ReadCallback = (
  err: NodeJS.ErrnoException | null,
  bytesRead: number,
  buffer: NodeJS.ArrayBufferView
) => void

export const read = createIFSMethod<'read'>(
  (
    fd: number,
    bufferOrOptionsOrCallback:
      | NodeJS.ArrayBufferView
      | ReadAsyncOptions<NodeJS.ArrayBufferView>
      | ReadCallback,
    offsetOrCallback?: number | null | ReadCallback,
    length?: number | null,
    position?: ReadPosition | null,
    callback?: ReadCallback
  ): void | Promise<{ bytesRead: number; buffer: NodeJS.ArrayBufferView }> => {
    // Handle options style call
    if (
      bufferOrOptionsOrCallback &&
      typeof bufferOrOptionsOrCallback === 'object' &&
      !Buffer.isBuffer(bufferOrOptionsOrCallback) &&
      !ArrayBuffer.isView(bufferOrOptionsOrCallback)
    ) {
      const options = bufferOrOptionsOrCallback
      const buffer = options.buffer || new Uint8Array(options.length || 0)
      const offset = options.offset || 0
      const length = options.length || buffer.byteLength - offset
      const position = options.position ?? null

      return new Promise((resolve, reject) => {
        read(
          fd,
          buffer,
          offset,
          length,
          position,
          (error, bytesRead, buffer) => {
            if (error) reject(error)
            else resolve({ bytesRead, buffer })
          }
        )
      })
    }

    // Handle callback style call
    let buffer: NodeJS.ArrayBufferView | undefined
    let offset = 0
    let cb: ReadCallback | undefined =
      typeof callback === 'function' ? callback : undefined

    if (typeof bufferOrOptionsOrCallback === 'function') {
      cb = bufferOrOptionsOrCallback
    } else {
      buffer = bufferOrOptionsOrCallback
      if (typeof offsetOrCallback === 'function') {
        cb = offsetOrCallback
      } else if (offsetOrCallback !== undefined && offsetOrCallback !== null) {
        offset = offsetOrCallback
      }
    }

    if (!buffer) {
      throw new Error('Buffer is required')
    }

    const readLength = length ?? buffer.byteLength - offset
    const readPosition = position ?? null

    const operation = async () => {
      const fdInfo = validateFd(fd)

      // Read file content
      const fileData = await vscode.workspace.fs.readFile(fdInfo.uri)

      // Calculate actual read position
      const actualPosition =
        typeof readPosition === 'bigint'
          ? Number(readPosition)
          : (readPosition ?? fdInfo.position)

      // Calculate actual bytes to read
      const available = Math.max(0, fileData.length - actualPosition)
      const bytesToRead = Math.min(readLength, available)

      if (bytesToRead === 0) {
        return 0
      }

      // Copy data to target buffer
      const sourceData = fileData.slice(
        actualPosition,
        actualPosition + bytesToRead
      )
      const targetView = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset + offset,
        bytesToRead
      )
      targetView.set(sourceData)

      // Update file position if not specified
      if (readPosition === null) {
        fdInfo.position += bytesToRead
      }

      return bytesToRead
    }

    if (cb) {
      operation()
        .then(bytesRead => cb!(null, bytesRead, buffer!))
        .catch(error => cb!(error as NodeJS.ErrnoException, 0, buffer!))
      return
    }

    throw new Error('Callback required')
  }
)
