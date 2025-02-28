import { t } from 'i18next'
import * as git from 'isomorphic-git'
import type { IFS } from 'unionfs'

import type { FileDiff } from './types'

/**
 * Git operations wrapper: wrap common operations of isomorphic-git
 */
export class GitOperations {
  private fs: IFS['promises']

  private dir: string

  constructor(fs: IFS, dir: string) {
    this.fs = fs.promises
    this.dir = dir
  }

  async init(): Promise<void> {
    await git.init({
      fs: this.fs,
      dir: this.dir,
      defaultBranch: 'main'
    })
    await git.setConfig({
      fs: this.fs,
      dir: this.dir,
      path: 'user.name',
      value: 'File Checkpoint'
    })
    await git.setConfig({
      fs: this.fs,
      dir: this.dir,
      path: 'user.email',
      value: 'noreply@example.com'
    })
  }

  async add(filepath: string): Promise<void> {
    await git.add({
      fs: this.fs,
      dir: this.dir,
      filepath,
      parallel: true
    })
  }

  async commit(message: string): Promise<string> {
    return await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: {
        name: 'File Checkpoint',
        email: 'noreply@example.com'
      }
    })
  }

  async addAllAndCommit(message: string): Promise<string> {
    try {
      const files = await this.listFiles()

      if (files.length === 0) {
        // Get the latest commit hash
        const commits = await git.log({ fs: this.fs, dir: this.dir, depth: 1 })
        if (commits.length === 0) {
          throw new Error(
            t('extension.workspaceCheckpoint.git.errors.noCommitsNoFiles')
          )
        }
        return commits[0]!.oid
      }
      throw new Error(
        t('extension.workspaceCheckpoint.git.errors.noCommitsNoFiles')
      )
    } catch {
      await this.add('.')
      return await this.commit(message)
    }
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({
      fs: this.fs,
      dir: this.dir,
      ref,
      force: true
    })
  }

  async listFiles(): Promise<string[]> {
    return await git.listFiles({
      fs: this.fs,
      dir: this.dir
    })
  }

  async getDiff(oldHash?: string, newHash?: string): Promise<FileDiff[]> {
    if (!oldHash) {
      const commits = await git.log({ fs: this.fs, dir: this.dir })
      oldHash = commits[commits.length - 1]?.oid
    }
    const diffs = await git.walk({
      fs: this.fs,
      dir: this.dir,
      trees: [
        git.TREE({ ref: oldHash }),
        newHash ? git.TREE({ ref: newHash }) : git.WORKDIR()
      ],
      map: async (filepath, [oldWalker, newWalker]) => {
        if (!oldWalker || !newWalker) return
        const oldOid = await oldWalker.oid()
        const newOid = await newWalker.oid()
        if (oldOid === newOid) return
        const getContent = async (walker: git.WalkerEntry | null) => {
          if (!walker) return ''
          const entry = await walker
          return entry ? Buffer.from(entry.toString()).toString('utf-8') : ''
        }
        return {
          relativePath: filepath,
          absolutePath: '', // complete absolute path in WorkspaceCheckpoint
          before: await getContent(oldWalker),
          after: await getContent(newWalker)
        } as FileDiff
      }
    })
    return diffs.filter(Boolean) as FileDiff[]
  }
}
