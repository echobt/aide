import type { PathLike, WriteStream } from 'fs'
import { Writable } from 'stream'

import { createIFSMethod, getPromisifyFn, type NodeFS } from '../helpers/utils'
import { writeFile } from './write-file'

export const createWriteStream = createIFSMethod<'createWriteStream'>(
  (
    path: PathLike,
    options?: Parameters<NodeFS['createWriteStream']>[1]
  ): WriteStream => {
    // Create stream with proper options
    const streamOptions =
      typeof options === 'string' ? { encoding: options } : options || {}

    const chunks: Buffer[] = []
    let bytesWritten = 0
    let destroyed = false

    // Create writable stream
    const stream = new Writable({
      highWaterMark: streamOptions.highWaterMark,
      signal: streamOptions.signal || undefined,
      autoDestroy: streamOptions.autoClose !== false,
      emitClose: streamOptions.emitClose !== false,
      write(
        chunk: any,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void
      ) {
        if (destroyed) {
          callback(new Error('Stream is destroyed'))
          return
        }

        try {
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk, encoding)

          if (streamOptions.start != null) {
            // If start is specified, we need to track the position
            const position = bytesWritten + streamOptions.start
            chunks.push(Buffer.alloc(position - bytesWritten), buffer)
          } else {
            chunks.push(buffer)
          }

          bytesWritten += buffer.length
          callback()
        } catch (error) {
          callback(error as Error)
        }
      },
      final(callback: (error?: Error | null) => void) {
        if (destroyed) {
          callback()
          return
        }

        const buffer = Buffer.concat(chunks)

        // Use async/await pattern for writeFile
        ;(async () => {
          try {
            await getPromisifyFn<'writeFile'>(writeFile)(path, buffer, {
              encoding: streamOptions.encoding,
              mode: streamOptions.mode,
              flag: streamOptions.flags
            })
            callback()
            stream.emit('close')
          } catch (error) {
            callback(error as Error)
            stream.emit('error', error as Error)
          }
        })()
      },
      destroy(error: Error | null, callback: (error: Error | null) => void) {
        destroyed = true
        chunks.length = 0
        callback(error)
      }
    }) as WriteStream & { path: string; pending: boolean }

    // Initialize properties required by WriteStream interface
    stream.bytesWritten = 0
    stream.path = path.toString()
    stream.pending = false

    // Update bytesWritten on each write
    const originalWrite = stream.write.bind(stream)
    stream.write = (
      chunk: any,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void
    ): boolean => {
      const result = originalWrite(chunk, encodingOrCallback as any, callback)
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as string, encodingOrCallback as BufferEncoding)
      stream.bytesWritten += buffer.length
      return result
    }

    return stream
  }
)
