import type { BigIntStats, PathLike, StatOptions, Stats } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'

export const lstat = createIFSMethod<'lstat'>(
  async (
    path: PathLike,
    optionsOrCallback?:
      | ((err: NodeJS.ErrnoException | null, stats: Stats) => void)
      | (StatOptions & {
          bigint: true
        })
      | StatOptions
      | undefined,
    callback?: (
      err: NodeJS.ErrnoException | null,
      stats: Stats | BigIntStats
    ) => void
  ): Promise<Stats | BigIntStats | void> => {
    const callbackFn =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    const operation = async () => {
      const uri = await getUri(path)
      const stat = await vscode.workspace.fs.stat(uri)

      const baseStats: Stats = {
        isFile: () => stat.type === vscode.FileType.File,
        isDirectory: () => stat.type === vscode.FileType.Directory,
        isSymbolicLink: () => stat.type === vscode.FileType.SymbolicLink,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        size: stat.size,
        mtime: new Date(stat.mtime),
        ctime: new Date(stat.ctime),
        atime: new Date(),
        birthtime: new Date(),
        mode: 0o666,
        blocks: 1,
        blksize: 4096,
        dev: 0,
        gid: 0,
        ino: 0,
        nlink: 1,
        rdev: 0,
        uid: 0,
        atimeMs: stat.mtime,
        mtimeMs: stat.mtime,
        ctimeMs: stat.ctime,
        birthtimeMs: stat.ctime
      }

      // Handle bigint option
      if (
        optionsOrCallback &&
        typeof optionsOrCallback === 'object' &&
        optionsOrCallback.bigint
      ) {
        return {
          ...baseStats,
          dev: BigInt(baseStats.dev),
          ino: BigInt(baseStats.ino),
          mode: BigInt(baseStats.mode),
          nlink: BigInt(baseStats.nlink),
          uid: BigInt(baseStats.uid),
          gid: BigInt(baseStats.gid),
          rdev: BigInt(baseStats.rdev),
          size: BigInt(baseStats.size),
          blksize: BigInt(baseStats.blksize),
          blocks: BigInt(baseStats.blocks),
          atimeMs: BigInt(baseStats.atimeMs),
          mtimeMs: BigInt(baseStats.mtimeMs),
          ctimeMs: BigInt(baseStats.ctimeMs),
          birthtimeMs: BigInt(baseStats.birthtimeMs),
          atimeNs: BigInt(baseStats.atimeMs) * BigInt(1e6),
          mtimeNs: BigInt(baseStats.mtimeMs) * BigInt(1e6),
          ctimeNs: BigInt(baseStats.ctimeMs) * BigInt(1e6),
          birthtimeNs: BigInt(baseStats.birthtimeMs) * BigInt(1e6)
        } as BigIntStats
      }

      return baseStats as Stats
    }

    if (callbackFn) {
      operation()
        .then(stats => callbackFn(null, stats as Stats))
        .catch(callbackFn as (err: NodeJS.ErrnoException | null) => void)
      return
    }

    return operation()
  }
)
