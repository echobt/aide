import type { PathLike, ReadStream } from 'fs'
import { Readable, type ReadableOptions } from 'stream'

import { createIFSMethod, getPromisifyFn, type NodeFS } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'
import { readFile } from './read-file'

export const createReadStream = createIFSMethod<'createReadStream'>(
  (
    path: PathLike,
    options?: Parameters<NodeFS['createReadStream']>[1]
  ): ReadStream => {
    // Create stream with proper options
    const streamOptions =
      typeof options === 'string' ? { encoding: options } : options || {}

    let bytesRead = 0
    let destroyed = false
    let buffer: Buffer | null = null
    let position = streamOptions.start || 0
    const { end } = streamOptions

    // Create readable stream
    const stream = new Readable({
      ...(streamOptions as ReadableOptions),
      autoDestroy: streamOptions.autoClose !== false,
      emitClose: streamOptions.emitClose !== false,
      read(size: number) {
        if (destroyed || buffer === null) return

        if (end !== undefined && position >= end) {
          this.push(null)
          return
        }

        const chunk = buffer.subarray(
          position,
          end !== undefined ? Math.min(position + size, end) : position + size
        )

        if (chunk.length === 0) {
          this.push(null)
          return
        }

        position += chunk.length
        bytesRead += chunk.length
        this.push(chunk)
      },
      destroy(error: Error | null, callback: (error: Error | null) => void) {
        destroyed = true
        buffer = null
        callback(error ? mapVSCodeError(error) : null)
      }
    }) as ReadStream & { path: string; pending: boolean }

    // Initialize properties required by ReadStream interface
    stream.path = path.toString()
    stream.pending = false
    stream.bytesRead = 0

    // Read file and handle as promise
    const readOperation = async () => {
      try {
        // Call readFile with callback style
        const data = await getPromisifyFn<'readFile'>(readFile)(path, {
          encoding: streamOptions.encoding,
          flag: streamOptions.flags
        })

        if (Buffer.isBuffer(data)) {
          buffer = data
          stream.read(0) // Start reading
        }
      } catch (error) {
        const mappedError = mapVSCodeError(error)
        stream.emit('error', mappedError)
        stream.destroy(mappedError)
      }
    }

    // Start reading
    readOperation()

    // Update bytesRead on each read
    const originalRead = stream.read.bind(stream)
    stream.read = (size?: number): any => {
      const chunk = originalRead(size)
      if (chunk) {
        stream.bytesRead = bytesRead
      }
      return chunk
    }

    return stream
  }
)
