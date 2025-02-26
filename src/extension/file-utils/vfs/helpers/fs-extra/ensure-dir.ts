import type { Mode, NoParamCallback } from 'fs'
import path from 'path'
import type { EnsureDirOptions } from 'fs-extra'
import { t } from 'i18next'
import type { IFS } from 'unionfs'

export const ensureDir = async (
  fs: IFS,
  dirPath: string,
  optionsOrCallback?: EnsureDirOptions | number | NoParamCallback
) => {
  checkPath(dirPath)

  return fs.promises.mkdir(dirPath, {
    mode: getMode(optionsOrCallback),
    recursive: true
  })
}

const checkPath = (pth: string) => {
  if (process.platform === 'win32') {
    const pathHasInvalidWinCharacters = /[<>:"|?*]/.test(
      pth.replace(path.parse(pth).root, '')
    )

    if (pathHasInvalidWinCharacters) {
      const error = new Error(
        t('extension.vfs.ensureDir.errors.invalidCharacters', { path: pth })
      )
      ;(error as NodeJS.ErrnoException).code = 'EINVAL'
      throw error
    }
  }
}

const getMode = (
  options: EnsureDirOptions | number | NoParamCallback | undefined
): Mode => {
  const defaults = { mode: 0o777 }
  if (typeof options === 'number') return options
  return { ...defaults, ...options }.mode
}
