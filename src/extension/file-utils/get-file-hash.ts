import crypto from 'crypto'

import { vfs } from './vfs'

export const getFileHash = async (schemeUri: string) => {
  const content = await vfs.promises.readFile(schemeUri, 'utf-8')
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex')
}
