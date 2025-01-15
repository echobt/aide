import type { FileInfo } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'

export const getFileContent = async (fileInfo: FileInfo): Promise<string> => {
  if (fileInfo.content) {
    return fileInfo.content
  }

  return await vfs.readFilePro(fileInfo.schemeUri, 'utf-8')
}
