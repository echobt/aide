import { projectDB } from '@extension/lowdb/project-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { Project } from '@shared/entities'
import { z } from 'zod'

// Create schema for validation
const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .refine(name => !name.includes('/') && !name.includes('\\'), {
      message: 'Project name cannot contain slashes or backslashes'
    })
    .refine(
      async name => {
        const projects = await projectDB.getAll()
        return !projects.some(p => p.name === name)
      },
      {
        message: 'Project name must be unique'
      }
    ),
  path: z.string().min(1, 'Project path is required'),
  description: z.string().optional()
})

export class ProjectActionsCollection extends ServerActionCollection {
  readonly categoryName = 'project'

  private async validateProject(
    data: Partial<Project>,
    excludeId?: string
  ): Promise<void> {
    const projects = await projectDB.getAll()
    const schema = projectSchema.extend({
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

  async getProjects(context: ActionContext<{}>) {
    return await projectDB.getAll()
  }

  async addProject(
    context: ActionContext<{
      name: string
      path: string
      description: string
    }>
  ) {
    const { actionParams } = context
    const { name, path, description } = actionParams
    const now = Date.now()

    // Validate project data
    await this.validateProject({ name, path, description })

    return await projectDB.add({
      name,
      path,
      description,
      createdAt: now,
      updatedAt: now
    })
  }

  async updateProject(
    context: ActionContext<{
      id: string
      name: string
      path: string
      description: string
    }>
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams

    // Validate project data
    await this.validateProject(updates, id)

    return await projectDB.update(id, {
      ...updates,
      updatedAt: Date.now()
    })
  }

  async removeProjects(context: ActionContext<{ ids: string[] }>) {
    const { actionParams } = context
    const { ids } = actionParams
    await projectDB.batchRemove(ids)
  }

  async searchProjects(context: ActionContext<{ query: string }>) {
    const { actionParams } = context
    const { query } = actionParams
    const projects = await projectDB.getAll()
    return projects.filter(
      project =>
        project.name.toLowerCase().includes(query.toLowerCase()) ||
        project.path.toLowerCase().includes(query.toLowerCase())
    )
  }
}
