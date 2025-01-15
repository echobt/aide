import type { FSWatcher, PathLike, WatchListener, WatchOptions } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod } from '../helpers/utils'
import { fileSystemWatchers } from './_helpers'

type WatchImplementation = {
  (
    filename: PathLike,
    options: WatchOptions & { encoding: 'buffer' },
    listener?: WatchListener<Buffer>
  ): FSWatcher
  (
    filename: PathLike,
    options?: WatchOptions | BufferEncoding | null,
    listener?: WatchListener<string>
  ): FSWatcher
  (filename: PathLike, listener?: WatchListener<string>): FSWatcher
}

export const watch = createIFSMethod<'watch'>(((
  filename: PathLike,
  optionsOrListener?:
    | WatchOptions
    | BufferEncoding
    | WatchListener<string | Buffer>
    | null,
  listener?: WatchListener<string | Buffer>
): FSWatcher => {
  // Normalize arguments
  let options: WatchOptions = {
    persistent: true,
    recursive: false,
    encoding: 'utf-8'
  }
  let watchListener: WatchListener<string | Buffer> | undefined

  if (typeof optionsOrListener === 'function') {
    watchListener = optionsOrListener as WatchListener<string | Buffer>
  } else if (optionsOrListener) {
    if (typeof optionsOrListener === 'string') {
      options = { ...options, encoding: optionsOrListener }
    } else {
      options = { ...options, ...optionsOrListener }
    }
    watchListener = listener
  } else {
    watchListener = listener
  }

  const path = filename.toString()

  // if exists, return existing watcher
  const existingWatcher = fileSystemWatchers.get(path)
  if (existingWatcher) {
    if (watchListener) {
      existingWatcher.onDidChange(uri => {
        const name =
          options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
        watchListener!('change', name)
      })

      existingWatcher.onDidCreate(uri => {
        const name =
          options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
        watchListener!('rename', name)
      })

      existingWatcher.onDidDelete(uri => {
        const name =
          options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
        watchListener!('rename', name)
      })
    }

    return createFSWatcher(existingWatcher, path)
  }

  // create new watcher
  const uri = vscode.Uri.file(path)
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(uri, '*'),
    !options.recursive
  )

  // store watcher for reuse
  fileSystemWatchers.set(path, watcher)

  if (watchListener) {
    watcher.onDidChange(uri => {
      const name =
        options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
      watchListener!('change', name)
    })

    watcher.onDidCreate(uri => {
      const name =
        options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
      watchListener!('rename', name)
    })

    watcher.onDidDelete(uri => {
      const name =
        options.encoding === 'buffer' ? Buffer.from(uri.fsPath) : uri.fsPath
      watchListener!('rename', name)
    })
  }

  return createFSWatcher(watcher, path)
}) as WatchImplementation)

const createFSWatcher = (
  watcher: vscode.FileSystemWatcher,
  path: string
): FSWatcher => {
  const fsWatcher: FSWatcher = {
    close() {
      watcher.dispose()
      fileSystemWatchers.delete(path)
    },
    ref() {
      return this
    },
    unref() {
      return this
    },
    addListener(_event: string | symbol, _listener: (...args: any[]) => void) {
      return this
    },
    on(_event: string | symbol, _listener: (...args: any[]) => void) {
      return this
    },
    once(_event: string | symbol, _listener: (...args: any[]) => void) {
      return this
    },
    prependListener(
      _event: string | symbol,
      _listener: (...args: any[]) => void
    ) {
      return this
    },
    prependOnceListener(
      _event: string | symbol,
      _listener: (...args: any[]) => void
    ) {
      return this
    },
    removeListener(
      _event: string | symbol,
      _listener: (...args: any[]) => void
    ) {
      return this
    },
    off(_event: string | symbol, _listener: (...args: any[]) => void) {
      return this
    },
    removeAllListeners(_event?: string | symbol) {
      return this
    },
    setMaxListeners(_n: number) {
      return this
    },
    getMaxListeners() {
      return 0
    },
    listeners(_event: string | symbol) {
      return []
    },
    rawListeners(_event: string | symbol) {
      return []
    },
    emit(_event: string | symbol, ..._args: any[]) {
      return false
    },
    listenerCount(_event: string | symbol) {
      return 0
    },
    eventNames() {
      return []
    }
  }

  return fsWatcher
}
