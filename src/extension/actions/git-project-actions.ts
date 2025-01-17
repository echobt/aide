import { gitUtils } from '@extension/file-utils/git'
import {
  traverseFileOrFolders,
  type FileInfo,
  type FolderInfo
} from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { gitProjectSchemeHandler } from '@extension/file-utils/vfs/schemes/git-project-scheme'
import { gitProjectDB } from '@extension/lowdb/git-project-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { GitProject, GitProjectType } from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { z } from 'zod'

// Create schema for validation
const gitProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .refine(name => !name.includes('/') && !name.includes('\\'), {
      message: 'Project name cannot contain slashes or backslashes'
    })
    .refine(
      async name => {
        const projects = await gitProjectDB.getAll()
        return !projects.some(p => p.name === name)
      },
      {
        message: 'Project name must be unique'
      }
    ),
  type: z.enum(['github', 'gitlab', 'bitbucket']),
  repoUrl: z.string().url('Invalid repository URL'),
  description: z.string().optional()
})

export class GitProjectActionsCollection extends ServerActionCollection {
  readonly categoryName = 'gitProject'

  private async validateProject(
    data: Partial<GitProject>,
    excludeId?: string
  ): Promise<void> {
    const projects = await gitProjectDB.getAll()
    const schema = gitProjectSchema.extend({
      name: z
        .string()
        .min(1, 'Project name is required')
        .refine(name => !name.includes('/') && !name.includes('\\'), {
          message: 'Project name cannot contain slashes or backslashes'
        })
        .refine(
          async name =>
            !projects.some(p => p.name === name && p.id !== excludeId),
          {
            message: 'Project name must be unique'
          }
        )
    })

    await schema.parseAsync(data)
  }

  private async cloneRepo(repoUrl: string, type: GitProjectType, name: string) {
    const gitProjectSchemeUri = gitProjectSchemeHandler.createSchemeUri({
      name,
      type,
      relativePath: './'
    })

    // Remove existing directory if it exists
    try {
      await vfs.promises.rm(gitProjectSchemeUri, {
        recursive: true,
        force: true
      })
    } catch {}

    // Ensure parent directory exists
    await vfs.ensureDir(
      gitProjectSchemeHandler.createSchemeUri({
        type,
        name: '',
        relativePath: ''
      })
    )

    // Clone repository
    const gitProjectPath = await vfs.resolveFullPathProAsync(
      gitProjectSchemeUri,
      false
    )
    const git = await gitUtils.createGit()
    await git.clone(repoUrl, gitProjectPath)
  }

  async getGitProjects(context: ActionContext<{}>) {
    return await gitProjectDB.getAll()
  }

  async addGitProject(
    context: ActionContext<{
      name: string
      type: GitProjectType
      repoUrl: string
      description: string
    }>
  ) {
    const { actionParams } = context
    const { name, type, repoUrl, description } = actionParams
    const now = Date.now()

    // Validate project data
    await this.validateProject({ name, type, repoUrl, description })

    // Clone repository first
    await this.cloneRepo(repoUrl, type, name)

    return await gitProjectDB.add({
      name,
      type,
      repoUrl,
      description,
      createdAt: now,
      updatedAt: now
    })
  }

  async updateGitProject(
    context: ActionContext<{
      id: string
      name: string
      type: GitProjectType
      repoUrl: string
      description: string
    }>
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams

    // Validate project data
    await this.validateProject(updates, id)

    // Get old project data
    const oldProject = (await gitProjectDB.getAll()).find(
      project => project.id === id
    )
    if (!oldProject) throw new Error('Project not found')

    // If repo URL changed, re-clone repository
    if (oldProject && oldProject.repoUrl !== updates.repoUrl) {
      await this.cloneRepo(updates.repoUrl, updates.type, updates.name)
    }

    return await gitProjectDB.update(id, {
      ...updates,
      updatedAt: Date.now()
    })
  }

  async removeGitProjects(context: ActionContext<{ ids: string[] }>) {
    const { actionParams } = context
    const { ids } = actionParams

    // Get projects before deletion
    const projects = (await gitProjectDB.getAll()).filter(project =>
      ids.includes(project.id)
    )

    // Remove project directories
    await settledPromiseResults(
      projects.map(async project => {
        const schemeUri = gitProjectSchemeHandler.createSchemeUri({
          name: project.name,
          type: project.type,
          relativePath: './'
        })

        await vfs.promises.rm(schemeUri, { recursive: true, force: true })
      })
    )

    await gitProjectDB.batchRemove(ids)
  }

  async searchGitProjects(context: ActionContext<{ query: string }>) {
    const { actionParams } = context
    const { query } = actionParams
    const projects = await gitProjectDB.getAll()
    return projects.filter(
      project =>
        project.name.toLowerCase().includes(query.toLowerCase()) ||
        project.repoUrl.toLowerCase().includes(query.toLowerCase())
    )
  }

  async refreshGitProject(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    const project = (await gitProjectDB.getAll()).find(
      project => project.id === id
    )
    if (!project) throw new Error('Project not found')

    const schemeUri = gitProjectSchemeHandler.createSchemeUri({
      name: project.name,
      type: project.type,
      relativePath: './'
    })
    const projectPath = await vfs.resolveFullPathProAsync(schemeUri, false)

    // Pull latest changes
    const git = await gitUtils.createGit(projectPath)
    await git.pull()

    // Update timestamp
    await gitProjectDB.update(id, {
      updatedAt: Date.now()
    })

    return project
  }

  async getGitProjectFilesAndFolders(
    context: ActionContext<{ projectIds?: string[] }>
  ): Promise<Record<string, (FileInfo | FolderInfo)[]>> {
    const { actionParams } = context
    const projectIds =
      actionParams.projectIds ?? (await gitProjectDB.getAll()).map(p => p.id)
    const projects = await gitProjectDB.getAll()
    const result: Record<string, (FileInfo | FolderInfo)[]> = {}

    // Get files and folders for each project
    await settledPromiseResults(
      projectIds.map(async projectId => {
        const project = projects.find(p => p.id === projectId)
        if (!project) {
          result[projectId] = []
          return
        }

        const gitProjectSchemeUri = gitProjectSchemeHandler.createSchemeUri({
          name: project.name,
          type: project.type,
          relativePath: './'
        })

        const items = await traverseFileOrFolders({
          type: 'fileOrFolder',
          schemeUris: [gitProjectSchemeUri],
          isGetFileContent: false,
          itemCallback: item => item
        })

        result[projectId] = items
      })
    )

    return result
  }
}
