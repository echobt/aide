import type { NoParamCallback } from 'fs'

import { createIFSMethod } from '../helpers/utils'
import { fdMap } from './_helpers'

export const close = createIFSMethod<'close'>(
  async (fd: number, callback?: NoParamCallback): Promise<void> => {
    const operation = async () => {
      if (!fdMap.has(fd)) {
        throw new Error('EBADF: bad file descriptor')
      }
      fdMap.delete(fd)
    }

    if (callback) {
      try {
        await operation()
        callback(null)
      } catch (error) {
        callback(error as NodeJS.ErrnoException)
      }
      return
    }

    return operation()
  }
)
