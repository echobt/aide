import type {
  BigIntStats,
  PathLike,
  Stats,
  StatWatcher,
  WatchFileOptions
} from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getPromisifyFn } from '../helpers/utils'
import { fileWatchers } from './_helpers'
import { stat } from './stat'

type WatchFileImplementation = {
  (
    filename: PathLike,
    options: WatchFileOptions & { bigint: true },
    listener: (curr: BigIntStats, prev: BigIntStats) => void
  ): StatWatcher
  (
    filename: PathLike,
    options?: WatchFileOptions & { bigint?: false | undefined },
    listener?: (curr: Stats, prev: Stats) => void
  ): StatWatcher
  (
    filename: PathLike,
    listener?: (curr: Stats, prev: Stats) => void
  ): StatWatcher
}

export const watchFile = createIFSMethod<'watchFile'>(((
  filename: PathLike,
  optionsOrListener?:
    | WatchFileOptions
    | ((curr: Stats | BigIntStats, prev: Stats | BigIntStats) => void),
  listener?: (curr: Stats | BigIntStats, prev: Stats | BigIntStats) => void
): StatWatcher => {
  // Normalize arguments
  let options: WatchFileOptions = {
    persistent: true,
    interval: 5007
  }
  let watchListener: (
    curr: Stats | BigIntStats,
    prev: Stats | BigIntStats
  ) => void

  if (typeof optionsOrListener === 'function') {
    watchListener = optionsOrListener
  } else if (optionsOrListener) {
    options = { ...options, ...optionsOrListener }
    watchListener = listener!
  } else {
    watchListener = listener!
  }

  const path = filename.toString()

  // add listener to map
  let watchers = fileWatchers.get(path)
  if (!watchers) {
    watchers = new Set()
    fileWatchers.set(path, watchers)
  }
  watchers.add(watchListener)

  let prevStats: Stats | BigIntStats | null = null
  let disposed = false

  const uri = vscode.Uri.file(path)
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(uri, '*')
  )

  const checkFile = async () => {
    if (disposed) return

    try {
      const statFn = getPromisifyFn<'stat'>(stat)
      const currStats = options.bigint
        ? await statFn(filename, { bigint: true })
        : await statFn(filename)

      // notify all listeners
      const allWatchers = fileWatchers.get(path)
      if (allWatchers) {
        for (const listener of allWatchers) {
          if (prevStats) {
            listener(currStats, prevStats)
          } else {
            listener(currStats, currStats)
          }
        }
      }
      prevStats = currStats
    } catch (error) {
      // Ignore errors
    }
  }

  // Initial check
  checkFile()

  // Set up file watcher
  watcher.onDidChange(() => {
    checkFile()
  })

  // Set up polling if interval is specified
  let intervalId: NodeJS.Timeout | undefined
  if (options.interval) {
    intervalId = setInterval(() => {
      checkFile()
    }, options.interval)
  }

  // Create StatWatcher interface
  const statWatcher = {
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
    },
    close() {
      disposed = true
      watcher.dispose()
      if (intervalId) {
        clearInterval(intervalId)
      }
      // 从映射中移除监听器
      const watchers = fileWatchers.get(path)
      if (watchers) {
        watchers.delete(watchListener)
        if (watchers.size === 0) {
          fileWatchers.delete(path)
        }
      }
    }
  } as StatWatcher

  return statWatcher
}) as WatchFileImplementation)
