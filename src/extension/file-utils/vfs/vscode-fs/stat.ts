import type { PathLike, Stats } from 'fs'
import * as vscode from 'vscode'

import { createIFSMethod, getUri } from '../helpers/utils'
import { mapVSCodeError } from './_helpers'

export const stat = createIFSMethod<'stat'>(
  async (path: PathLike): Promise<Stats> => {
    try {
      const uri = await getUri(path)
      const stat = await vscode.workspace.fs.stat(uri)
      return {
        isFile: () => stat.type === vscode.FileType.File,
        isDirectory: () => stat.type === vscode.FileType.Directory,
        isSymbolicLink: () => stat.type === vscode.FileType.SymbolicLink,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        atimeMs: stat.ctime,
        mtimeMs: stat.mtime,
        ctimeMs: stat.ctime,
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
        uid: 0
      } as Stats
    } catch (error) {
      throw mapVSCodeError(error)
    }
  }
)
