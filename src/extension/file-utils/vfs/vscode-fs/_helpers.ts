import type { BigIntStats, Stats } from 'fs'
import * as vscode from 'vscode'

export interface FdInfo {
  uri: vscode.Uri
  position: number
  flags: number | string
  mode?: number
}

// Start from 3 since 0,1,2 are reserved for stdin/stdout/stderr
let nextFd = 3

export const fdMap = new Map<number, FdInfo>()

export const getNextFd = (): number => nextFd++

export const validateFd = (fd: number): FdInfo => {
  const fdInfo = fdMap.get(fd)
  if (!fdInfo) {
    throw new Error('EBADF: bad file descriptor')
  }
  return fdInfo
}

export const clearAllFds = (): void => {
  fdMap.clear()
  nextFd = 3
}

export const fileWatchers = new Map<
  string,
  Set<(curr: Stats | BigIntStats, prev: Stats | BigIntStats) => void>
>()

export const fileSystemWatchers = new Map<string, vscode.FileSystemWatcher>()

export type FileFlag =
  | 'r'
  | 'r+'
  | 'w'
  | 'w+'
  | 'a'
  | 'a+'
  | 'wx'
  | 'wx+'
  | 'ax'
  | 'ax+'

export interface FileFlagInfo {
  read: boolean
  write: boolean
  create: boolean
  truncate: boolean
  append: boolean
  exclusive?: boolean
}

// Supported file flags
export const FILE_FLAGS: Record<FileFlag, FileFlagInfo> = {
  r: {
    read: true,
    write: false,
    create: false,
    truncate: false,
    append: false
  },
  'r+': {
    read: true,
    write: true,
    create: false,
    truncate: false,
    append: false
  },
  w: { read: false, write: true, create: true, truncate: true, append: false },
  'w+': {
    read: true,
    write: true,
    create: true,
    truncate: true,
    append: false
  },
  a: { read: false, write: true, create: true, truncate: false, append: true },
  'a+': {
    read: true,
    write: true,
    create: true,
    truncate: false,
    append: true
  },
  wx: {
    read: false,
    write: true,
    create: true,
    truncate: true,
    append: false,
    exclusive: true
  },
  'wx+': {
    read: true,
    write: true,
    create: true,
    truncate: true,
    append: false,
    exclusive: true
  },
  ax: {
    read: false,
    write: true,
    create: true,
    truncate: false,
    append: true,
    exclusive: true
  },
  'ax+': {
    read: true,
    write: true,
    create: true,
    truncate: false,
    append: true,
    exclusive: true
  }
}

export const mapVSCodeError = (error: any): NodeJS.ErrnoException => {
  const err = new Error(error.message) as NodeJS.ErrnoException

  if (error instanceof vscode.FileSystemError) {
    switch (error.code) {
      case 'FileNotFound':
        err.code = 'ENOENT'
        break
      case 'FileExists':
        err.code = 'EEXIST'
        break
      case 'FileNotADirectory':
        err.code = 'ENOTDIR'
        break
      case 'FileIsADirectory':
        err.code = 'EISDIR'
        break
      case 'NoPermissions':
        err.code = 'EACCES'
        break
      case 'Unavailable':
        err.code = 'EBUSY'
        break
      default:
        err.code = 'UNKNOWN'
    }
  }

  return err
}
