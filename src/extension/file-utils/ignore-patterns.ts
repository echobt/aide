import path from 'path'
import { getConfigKey } from '@extension/config'
import { logger } from '@extension/logger'
import { settledPromiseResults, toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import { glob } from 'glob'
import ignore from 'ignore'
import { Minimatch } from 'minimatch'

import { vfs } from './vfs'

/**
 * Creates a function that determines whether a file should be ignored based on the provided ignore patterns.
 * @param dirSchemeUri - The dir scheme uri.
 * @returns A function that takes a full file path as input and returns a boolean indicating whether the file should be ignored.
 * @throws An error if the workspace path cannot be determined.
 */
export const createShouldIgnore = async (
  dirSchemeUri: string,
  customIgnorePatterns?: string[]
) => {
  const ignorePatterns = await getConfigKey('ignorePatterns')
  const respectGitIgnore = await getConfigKey('respectGitIgnore')
  const fullDirPath = await vfs.resolveFullPathProAsync(dirSchemeUri, false)

  if (customIgnorePatterns) {
    ignorePatterns.push(...customIgnorePatterns)
  }

  let ig: ReturnType<typeof ignore> | null = null

  if (respectGitIgnore) {
    try {
      const gitignoreSchemeUri = SchemeUriHelper.join(
        dirSchemeUri,
        '.gitignore'
      )
      const gitIgnoreContent = await vfs.promises.readFile(
        gitignoreSchemeUri,
        'utf-8'
      )
      ig = ignore().add(gitIgnoreContent)
    } catch (error) {
      // .gitignore file doesn't exist or couldn't be read
      // logger.warn("Couldn't read .gitignore file:", error)
    }
  }

  const mms = ignorePatterns.map(
    pattern =>
      new Minimatch(pattern, {
        dot: true,
        matchBase: true
      })
  )

  /**
   * Determines whether a file should be ignored based on the ignore patterns.
   * @param schemeUriOrFileFullPath - The scheme path or file full path.
   * @returns A boolean indicating whether the file should be ignored.
   */
  const shouldIgnore = (schemeUriOrFileFullPath: string) => {
    try {
      let relativePath

      if (vfs.isSchemeUri(schemeUriOrFileFullPath)) {
        relativePath = vfs.resolveRelativePathProSync(schemeUriOrFileFullPath)
      } else {
        relativePath = path.relative(fullDirPath, schemeUriOrFileFullPath)
      }

      const unixRelativePath = toUnixPath(relativePath)

      if (!unixRelativePath) return false

      if (['.', './', '..', '../', '/'].includes(unixRelativePath)) {
        return false
      }

      if (ig && ig.ignores(unixRelativePath)) {
        return true
      }

      return mms.some(mm => mm.match(unixRelativePath))
    } catch (error) {
      logger.warn('shouldIgnore error', error)
      return false
    }
  }

  return shouldIgnore
}

/**
 * Retrieves all valid files in the specified directory path.
 * @param dirSchemeUri - The scheme path.
 * @returns A promise that resolves to an array of strings representing the absolute paths of the valid files.
 */
export const getAllValidFiles = async (
  dirSchemeUri: string,
  customShouldIgnore?: (fileFullPath: string) => boolean
): Promise<string[]> => {
  const shouldIgnore =
    customShouldIgnore || (await createShouldIgnore(dirSchemeUri))

  const fullDirPath = await vfs.resolveFullPathProAsync(dirSchemeUri, false)

  const allFilesFullPaths = await glob('**/*', {
    cwd: fullDirPath,
    nodir: true,
    absolute: true,
    follow: false,
    posix: true,
    dot: true,
    fs: vfs,
    ignore: {
      ignored(p) {
        try {
          return shouldIgnore(p.fullpath())
        } catch {
          return false
        }
      },
      childrenIgnored(p) {
        try {
          return shouldIgnore(p.fullpath())
        } catch {
          return false
        }
      }
    }
  })

  if (!vfs.isSchemeUri(dirSchemeUri)) {
    return allFilesFullPaths
  }

  // if the dirSchemeUri is a scheme uri, we need to convert the full paths to scheme uris
  const baseUri = vfs.resolveBaseUriProSync(dirSchemeUri)
  const basePath = await vfs.resolveBasePathProAsync(dirSchemeUri)

  return allFilesFullPaths.map(fullPath => {
    const relativePath = SchemeUriHelper.relative(basePath, fullPath)
    return SchemeUriHelper.join(baseUri, relativePath)
  })
}

/**
 * Retrieves all valid folders in the specified directory path.
 * @param dirSchemeUri - The scheme path.
 * @returns A promise that resolves to an array of strings representing the absolute paths of the valid folders.
 */
export const getAllValidFolders = async (
  dirSchemeUri: string,
  customShouldIgnore?: (fileFullPath: string) => boolean
): Promise<string[]> => {
  const shouldIgnore =
    customShouldIgnore || (await createShouldIgnore(dirSchemeUri))

  const fullDirPath = await vfs.resolveFullPathProAsync(dirSchemeUri, false)

  // TODO: ignore not working
  const filesOrFolders = await glob('**/*', {
    cwd: fullDirPath,
    nodir: false,
    absolute: true,
    follow: false,
    dot: true,
    posix: true,
    fs: vfs,
    ignore: {
      ignored(p) {
        try {
          return shouldIgnore(p.fullpath())
        } catch {
          return false
        }
      },
      childrenIgnored(p) {
        try {
          return shouldIgnore(p.fullpath())
        } catch {
          return false
        }
      }
    }
  })

  const folders: string[] = []
  const promises = filesOrFolders.map(async fileOrFolder => {
    const stat = await vfs.promises.stat(fileOrFolder)
    if (stat.isDirectory()) {
      folders.push(fileOrFolder)
    }
  })

  await settledPromiseResults(promises)

  if (!vfs.isSchemeUri(dirSchemeUri)) {
    return folders
  }

  const baseUri = vfs.resolveBaseUriProSync(dirSchemeUri)
  const basePath = await vfs.resolveBasePathProAsync(dirSchemeUri)

  return folders.map(folder => {
    const relativePath = SchemeUriHelper.relative(basePath, folder)
    return SchemeUriHelper.join(baseUri, relativePath)
  })
}
