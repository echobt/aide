import type { MaybePromise } from '@shared/types/common'
import { settledPromiseResults } from '@shared/utils/common'

import {
  createShouldIgnore,
  getAllValidFiles,
  getAllValidFolders
} from './ignore-patterns'
import { vfs } from './vfs'

export interface FileInfo {
  type: 'file'
  content: string // if isGetFileContent is false, content will be empty
  schemeUri: string
}

export interface FolderInfo {
  type: 'folder'
  schemeUri: string
}

type FsType = 'file' | 'folder' | 'fileOrFolder'

export type FsItemInfo = FileInfo | FolderInfo

export interface TraverseOptions<T, Type extends FsType = 'file'> {
  type: Type
  schemeUris: string[]
  isGetFileContent?: boolean // default is true
  ignorePatterns?: string[]
  customShouldIgnore?: (schemeUri: string) => boolean
  itemCallback: (
    itemInfo: Type extends 'file'
      ? FileInfo
      : Type extends 'folder'
        ? FolderInfo
        : FsItemInfo
  ) => MaybePromise<T>
}

const getFileInfo = async (
  schemeUri: string,
  isGetFileContent = true
): Promise<FileInfo | null> => {
  let fileContent = ''

  if (isGetFileContent) {
    fileContent = await vfs.readFilePro(schemeUri, 'utf-8')
  }

  return {
    type: 'file',
    content: fileContent,
    schemeUri
  }
}

const getFolderInfo = async (schemeUri: string): Promise<FolderInfo> => ({
  type: 'folder',
  schemeUri
})

const traverseOneProjectFs = async <T, Type extends FsType>(
  options: TraverseOptions<T, Type>
): Promise<T[]> => {
  const {
    type = 'file',
    schemeUris, // the same base path
    isGetFileContent = true,
    ignorePatterns,
    customShouldIgnore,
    itemCallback
  } = options
  const itemSchemePathSet = new Set<string>()
  const results: T[] = []

  if (!schemeUris.length) throw new Error('schemeUris is empty')

  let shouldIgnore = customShouldIgnore
  const basePath = await vfs.resolveBasePathProAsync(schemeUris[0]!)

  if (!shouldIgnore) {
    shouldIgnore = await createShouldIgnore(basePath, ignorePatterns)
  }

  const processFolder = async (dirSchemeUri: string) => {
    if (itemSchemePathSet.has(dirSchemeUri) || shouldIgnore(dirSchemeUri))
      return

    itemSchemePathSet.add(dirSchemeUri)
    const folderInfo = await getFolderInfo(dirSchemeUri)
    if (type === 'folder' || type === 'fileOrFolder') {
      results.push(await itemCallback(folderInfo as any))
    }
  }

  const processFile = async (fileSchemeUri: string) => {
    if (itemSchemePathSet.has(fileSchemeUri) || shouldIgnore(fileSchemeUri))
      return

    itemSchemePathSet.add(fileSchemeUri)
    const fileInfo = await getFileInfo(fileSchemeUri, isGetFileContent)
    if (fileInfo && (type === 'file' || type === 'fileOrFolder')) {
      results.push(await itemCallback(fileInfo as any))
    }
  }

  const getAllValidItemsWithCustomIgnore = async (schemeUri: string) => {
    if (type === 'folder') {
      return await getAllValidFolders(schemeUri, shouldIgnore)
    }
    if (type === 'file') {
      return await getAllValidFiles(schemeUri, shouldIgnore)
    }
    // For 'fileOrFolder' type, get both files and folders
    const files = await getAllValidFiles(schemeUri, shouldIgnore)
    const folders = await getAllValidFolders(schemeUri, shouldIgnore)
    return [...files, ...folders]
  }

  await Promise.allSettled(
    schemeUris.map(async schemeUri => {
      const stat = await vfs.promises.stat(schemeUri)

      if (stat.isDirectory()) {
        if (type === 'folder' || type === 'fileOrFolder') {
          await processFolder(schemeUri)
        }

        const allItemSchemeUris =
          await getAllValidItemsWithCustomIgnore(schemeUri)

        await Promise.allSettled(
          allItemSchemeUris.map(async itemSchemeUri => {
            const itemStat = await vfs.promises.stat(itemSchemeUri)

            if (itemStat.isDirectory()) {
              await processFolder(itemSchemeUri)
            } else {
              await processFile(itemSchemeUri)
            }
          })
        )
      }

      if (stat.isFile() && (type === 'file' || type === 'fileOrFolder')) {
        await processFile(schemeUri)
      }
    })
  )

  return results
}

export const traverseFileOrFolders = async <T, Type extends FsType>(
  options: TraverseOptions<T, Type>
): Promise<T[]> => {
  const {
    type = 'file',
    schemeUris,
    isGetFileContent = true,
    ignorePatterns,
    customShouldIgnore,
    itemCallback
  } = options

  const basePathSchemePathsMap = new Map<string, string[]>()

  await settledPromiseResults(
    schemeUris.map(async schemeUri => {
      const basePath = await vfs.resolveBasePathProAsync(schemeUri)
      basePathSchemePathsMap.set(basePath, [
        ...(basePathSchemePathsMap.get(basePath) || []),
        schemeUri
      ])
    })
  )

  const results = await settledPromiseResults(
    Array.from(basePathSchemePathsMap.entries()).map(
      async ([_, schemeUris]) =>
        await traverseOneProjectFs<T, Type>({
          type: type as Type,
          schemeUris,
          isGetFileContent,
          ignorePatterns,
          customShouldIgnore,
          itemCallback
        })
    )
  )

  return results.flat()
}
