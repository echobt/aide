import crypto from 'crypto'

import { VsCodeFS } from './vscode-fs'

export const getFileHash = async (filePath: string) => {
  const content = await VsCodeFS.readFile(filePath)
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex')
}
