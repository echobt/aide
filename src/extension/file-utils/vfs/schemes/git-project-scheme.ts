import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import type { GitProjectType } from '@shared/entities'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { BaseSchemeHandler, UriScheme } from '../helpers/utils'

// git-project://<type>/<name>/<relativePath>
export class GitProjectSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.GitProject)
  }

  private async getGitProjectPath(
    name: string,
    type: GitProjectType
  ): Promise<string> {
    const gitProjectsPath = await aidePaths.getGitProjectsPath()
    return path.join(gitProjectsPath, type, name)
  }

  resolveBaseUriSync(uri: string): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name] = uriHelper.getPathSegments()

    if (!type) throw new Error('Invalid git project URI: missing type')
    if (!name) throw new Error('Invalid git project URI: missing project name')

    return SchemeUriHelper.create(this.scheme, path.join(type, name))
  }

  async resolveBaseUriAsync(uri: string): Promise<string> {
    return this.resolveBaseUriSync(uri)
  }

  resolveBasePathSync(): string {
    throw new Error('Not implemented')
  }

  async resolveBasePathAsync(uri: string): Promise<string> {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name] = uriHelper.getPathSegments()

    if (!type) throw new Error('Invalid git project URI: missing type')
    if (!name) throw new Error('Invalid git project URI: missing project name')

    const projectPath = await this.getGitProjectPath(
      name,
      type as GitProjectType
    )
    return projectPath
  }

  resolveRelativePathSync(uri: string): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name, ...relativePathParts] = uriHelper.getPathSegments()

    if (!type) throw new Error('Invalid git project URI: missing type')
    if (!name) throw new Error('Invalid git project URI: missing project name')

    return relativePathParts.join('/')
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
    return path.join(basePath, relativePath)
  }

  createSchemeUri(props: {
    name: string
    type: GitProjectType
    relativePath: string
  }): string {
    return SchemeUriHelper.create(
      this.scheme,
      path.join(props.type, props.name, props.relativePath)
    )
  }
}

export const gitProjectSchemeHandler = new GitProjectSchemeHandler()
