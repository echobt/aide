import { projectDB } from '@extension/lowdb/project-db'
import { toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import { t } from 'i18next'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// project means the project folder in the workspace
// project://<projectName>/<relativePath>
export class ProjectSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.Project)
  }

  private async getProjectPath(name: string): Promise<string> {
    const projects = await projectDB.getAll()
    const project = projects.find(p => p.name === name)
    if (!project)
      throw new Error(
        t('extension.vfs.project.errors.projectNotFound', { name })
      )
    return toUnixPath(project.path)
  }

  resolveBaseUriSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName] = uriHelper.getPathSegments()

    if (!projectName && !skipValidateError)
      throw new Error(t('extension.vfs.project.errors.missingProjectName'))

    return SchemeUriHelper.create(this.scheme, projectName || '')
  }

  async resolveBaseUriAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveBaseUriSync(uri, skipValidateError)
  }

  resolveBasePathSync(): string {
    throw new Error(t('extension.vfs.project.errors.notImplemented'))
  }

  async resolveBasePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName] = uriHelper.getPathSegments()

    if (!projectName && !skipValidateError)
      throw new Error(t('extension.vfs.project.errors.missingProjectName'))

    const projectPath = await this.getProjectPath(projectName || '')
    return projectPath
  }

  resolveRelativePathSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectName, ...relativePathParts] = uriHelper.getPathSegments()

    if (!projectName && !skipValidateError)
      throw new Error(t('extension.vfs.project.errors.missingProjectName'))

    return relativePathParts.join('/') || './'
  }

  async resolveRelativePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveRelativePathSync(uri, skipValidateError)
  }

  resolveFullPathSync(): string {
    throw new Error(t('extension.vfs.project.errors.notImplemented'))
  }

  async resolveFullPathAsync(uri: string): Promise<string> {
    const basePath = await this.resolveBasePathAsync(uri, true)
    const relativePath = this.resolveRelativePathSync(uri, true)
    return SchemeUriHelper.join(basePath, relativePath)
  }

  createSchemeUri(props: { name: string; relativePath: string }): string {
    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(props.name, props.relativePath)
    )
  }
}

export const projectSchemeHandler = new ProjectSchemeHandler()
