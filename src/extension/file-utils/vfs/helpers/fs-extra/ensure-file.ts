import type { Stats } from 'fs'
import path from 'path'
import type { IFS } from 'unionfs'

import { ensureDir } from './ensure-dir'

export const ensureFile = async (fs: IFS, filePath: string) => {
  let stats

  try {
    stats = await fs.promises.stat(filePath)
  } catch {}

  if (stats && stats.isFile()) return

  const dirPath = path.dirname(filePath)

  let dirStats: Stats | null = null
  try {
    dirStats = await fs.promises.stat(dirPath)
  } catch (err) {
    // if the directory doesn't exist, make it
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureDir(fs, dirPath)
      await fs.promises.writeFile(filePath, '')
      return
    }
    throw err
  }

  if (dirStats.isDirectory()) {
    await fs.promises.writeFile(filePath, '')
  } else {
    // parent is not a directory
    // This is just to cause an internal ENOTDIR error to be thrown
    await fs.promises.readdir(dirPath)
  }
}
