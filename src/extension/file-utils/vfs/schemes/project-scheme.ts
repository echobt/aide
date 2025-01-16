import { projectDB } from '@extension/lowdb/project-db'
import { toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// project means the project folder in the workspace
// project://<projectName>/<relativePath>
export class ProjectSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.Project)
  }

  private async getProjectPath(projectName: string): Promise<string> {
    const projects = await projectDB.getAll()
    const project = projects.find(p => p.name === projectName)
    if (!project) throw new Error(`Project: ${projectName} not found`)
    return toUnixPath(project.path)
  }

  resolveBaseUriSync(uri: string): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName] = uriHelper.getPathSegments()

    if (!projectName)
      throw new Error('Invalid project URI: missing project name')

    return SchemeUriHelper.create(this.scheme, projectName)
  }

  async resolveBaseUriAsync(uri: string): Promise<string> {
    return this.resolveBaseUriSync(uri)
  }

  resolveBasePathSync(): string {
    throw new Error('Not implemented')
  }

  async resolveBasePathAsync(uri: string): Promise<string> {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName] = uriHelper.getPathSegments()

    if (!projectName)
      throw new Error('Invalid project URI: missing project name')

    const projectPath = await this.getProjectPath(projectName)
    return projectPath
  }

  resolveRelativePathSync(uri: string): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName, ...relativePathParts] = uriHelper.getPathSegments()

    if (!projectName)
      throw new Error('Invalid project URI: missing project name')

    return relativePathParts.join('/') || './'
  }

  async resolveRelativePathAsync(uri: string): Promise<string> {
    return this.resolveRelativePathSync(uri)
  }

  resolveFullPathSync(): string {
    throw new Error('Not implemented')
  }

  async resolveFullPathAsync(uri: string): Promise<string> {
    const basePath = await this.resolveBasePathAsync(uri)
    const relativePath = this.resolveRelativePathSync(uri)
    return SchemeUriHelper.join(basePath, relativePath)
  }

  createSchemeUri(props: {
    projectName: string
    relativePath: string
  }): string {
    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(props.projectName, props.relativePath)
    )
  }
}

export const projectSchemeHandler = new ProjectSchemeHandler()
