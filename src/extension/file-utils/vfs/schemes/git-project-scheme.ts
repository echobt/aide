import { aidePaths } from '@extension/file-utils/paths'
import type { GitProjectType } from '@shared/entities'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// git-project://<type>/<name>/<relativePath>
export class GitProjectSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.GitProject)
  }

  private async getGitProjectPath(
    type: GitProjectType,
    name: string
  ): Promise<string> {
    const gitProjectsPath = await aidePaths.getGitProjectsPath()
    return SchemeUriHelper.join(gitProjectsPath, type, name)
  }

  resolveBaseUriSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name] = uriHelper.getPathSegments()

    if (!type && !skipValidateError)
      throw new Error('Invalid git project URI: missing type')
    if (!name && !skipValidateError)
      throw new Error('Invalid git project URI: missing project name')

    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(type || '', name || '')
    )
  }

  async resolveBaseUriAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveBaseUriSync(uri, skipValidateError)
  }

  resolveBasePathSync(): string {
    throw new Error('Not implemented')
  }

  async resolveBasePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name] = uriHelper.getPathSegments()

    if (!type && !skipValidateError)
      throw new Error('Invalid git project URI: missing type')
    if (!name && !skipValidateError)
      throw new Error('Invalid git project URI: missing project name')

    const projectPath = await this.getGitProjectPath(
      type as GitProjectType,
      name || ''
    )
    return projectPath
  }

  resolveRelativePathSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [type, name, ...relativePathParts] = uriHelper.getPathSegments()

    if (!type && !skipValidateError)
      throw new Error('Invalid git project URI: missing type')
    if (!name && !skipValidateError)
      throw new Error('Invalid git project URI: missing project name')

    return relativePathParts.join('/') || './'
  }

  async resolveRelativePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveRelativePathSync(uri, skipValidateError)
  }

  resolveFullPathSync(): string {
    throw new Error('Not implemented')
  }

  async resolveFullPathAsync(uri: string): Promise<string> {
    const basePath = await this.resolveBasePathAsync(uri, true)
    const relativePath = this.resolveRelativePathSync(uri, true)
    return SchemeUriHelper.join(basePath, relativePath)
  }

  createSchemeUri(props: {
    name: string
    type: GitProjectType
    relativePath: string
  }): string {
    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(props.type, props.name, props.relativePath)
    )
  }
}

export const gitProjectSchemeHandler = new GitProjectSchemeHandler()
