import * as git from 'isomorphic-git'
import type { IFs } from 'memfs'

import { FileDiff, IGitOperations } from './types'

export class GitOperations implements IGitOperations {
  constructor(
    private readonly memfs: IFs,
    private readonly baseDir: string = '/'
  ) {}

  async init(): Promise<void> {
    await git.init({
      fs: this.memfs,
      dir: this.baseDir,
      defaultBranch: 'main'
    })

    await this.configureGit()
  }

  private async configureGit(): Promise<void> {
    await git.setConfig({
      fs: this.memfs,
      dir: this.baseDir,
      path: 'user.name',
      value: 'File Checkpoint'
    })
    await git.setConfig({
      fs: this.memfs,
      dir: this.baseDir,
      path: 'user.email',
      value: 'noreply@example.com'
    })
  }

  async add(path: string): Promise<void> {
    await git.add({
      fs: this.memfs,
      dir: this.baseDir,
      filepath: path
    })
  }

  async commit(message: string): Promise<string> {
    const sha = await git.commit({
      fs: this.memfs,
      dir: this.baseDir,
      message,
      author: {
        name: 'File Checkpoint',
        email: 'noreply@example.com'
      }
    })
    return sha
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({
      fs: this.memfs,
      dir: this.baseDir,
      ref,
      force: true
    })
  }

  async listFiles(): Promise<string[]> {
    return await git.listFiles({
      fs: this.memfs,
      dir: this.baseDir
    })
  }

  async getDiff(oldHash?: string, newHash?: string): Promise<FileDiff[]> {
    // Get first commit if oldHash not provided
    if (!oldHash) {
      const commits = await git.log({ fs: this.memfs, dir: this.baseDir })
      oldHash = commits[commits.length - 1]?.oid
      if (!oldHash) {
        return []
      }
    }

    const diffs = await git.walk({
      fs: this.memfs,
      dir: this.baseDir,
      trees: [
        git.TREE({ ref: oldHash }),
        newHash ? git.TREE({ ref: newHash }) : git.WORKDIR()
      ],
      map: async (filepath, [oldWalker, newWalker]) => {
        if (!oldWalker || !newWalker) return
        const oldContent = await oldWalker.oid()
        const newContent = await newWalker.oid()

        if (!oldContent && !newContent) return
        if (oldContent === newContent) return

        const getContent = async (walker: git.WalkerEntry | null) => {
          if (!walker) return ''
          const entry = await walker
          return entry ? Buffer.from(entry.toString()).toString('utf-8') : ''
        }

        return {
          relativePath: filepath,
          absolutePath: filepath, // Note: This is relative to baseDir
          before: await getContent(oldWalker),
          after: await getContent(newWalker)
        }
      }
    })

    return diffs.filter(Boolean) as FileDiff[]
  }
}
