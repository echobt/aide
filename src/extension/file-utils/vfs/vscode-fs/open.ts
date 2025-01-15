import type { Mode, OpenMode, PathLike } from 'fs'

import { createIFSMethod, getUri } from '../helpers/utils'
import { fdMap, getNextFd } from './_helpers'

type OpenCallback = (err: NodeJS.ErrnoException | null, fd: number) => void

export const open = createIFSMethod<'open'>(
  (
    path: PathLike,
    flagsOrCallback: OpenMode | OpenCallback,
    modeOrCallback?: Mode | OpenCallback,
    callback?: OpenCallback
  ): void | Promise<number> => {
    // Normalize arguments
    let flags: OpenMode = 'r'
    let mode = 0o666
    let cb: OpenCallback | undefined

    if (typeof flagsOrCallback === 'function') {
      cb = flagsOrCallback
    } else {
      flags = flagsOrCallback
      if (typeof modeOrCallback === 'function') {
        cb = modeOrCallback
      } else if (typeof modeOrCallback === 'number') {
        mode = modeOrCallback
        cb = callback
      }
      // TODO: if modeOrCallback is a string
    }

    const operation = async () => {
      const uri = await getUri(path)
      const fd = getNextFd()

      // Store file descriptor info
      fdMap.set(fd, {
        uri,
        position: 0,
        flags,
        mode
      })

      return fd
    }

    if (cb) {
      operation()
        .then(fd => cb!(null, fd))
        .catch(error => cb!(error as NodeJS.ErrnoException, -1))
      return
    }

    return operation()
  }
)
