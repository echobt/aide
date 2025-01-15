import type {
  BigIntStats,
  BigIntStatsListener,
  PathLike,
  Stats,
  StatsListener
} from 'fs'

import { createIFSMethod } from '../helpers/utils'
import { fileWatchers } from './_helpers'

export const unwatchFile = createIFSMethod<'unwatchFile'>(
  (
    filename: PathLike,
    listener?: StatsListener | BigIntStatsListener
  ): void => {
    const path = filename.toString()

    // if no listener, remove all listeners
    if (!listener) {
      fileWatchers.delete(path)
      return
    }

    // if provided listener, remove specific listener
    const watchers = fileWatchers.get(path)
    if (watchers) {
      watchers.delete(
        listener as (
          curr: Stats | BigIntStats,
          prev: Stats | BigIntStats
        ) => void
      )
      if (watchers.size === 0) {
        fileWatchers.delete(path)
      }
    }
  }
)
