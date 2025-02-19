/* eslint-disable unused-imports/no-unused-vars */
import { getWorkspaceFolder } from '@extension/utils'
import { toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// workspace://<relativePath>
export class WorkspaceSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.Workspace)
  }

  resolveBaseUriSync(uri: string, skipValidateError?: boolean): string {
    return SchemeUriHelper.create(this.scheme, '')
  }

  async resolveBaseUriAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveBaseUriSync(uri, skipValidateError)
  }

  resolveBasePathSync(uri: string, skipValidateError?: boolean): string {
    const workspaceFolder = getWorkspaceFolder()
    return toUnixPath(workspaceFolder.uri.fsPath)
  }

  async resolveBasePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveBasePathSync(uri, skipValidateError)
  }

  resolveRelativePathSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    return uriHelper.getPath() || './'
  }

  async resolveRelativePathAsync(
    uri: string,
    skipValidateError?: boolean
  ): Promise<string> {
    return this.resolveRelativePathSync(uri, skipValidateError)
  }

  resolveFullPathSync(uri: string): string {
    const basePath = this.resolveBasePathSync(uri, true)
    const relativePath = this.resolveRelativePathSync(uri, true)
    return SchemeUriHelper.join(basePath, relativePath)
  }

  async resolveFullPathAsync(uri: string): Promise<string> {
    return this.resolveFullPathSync(uri)
  }

  createSchemeUri(props: { relativePath?: string; fullPath?: string }): string {
    if (props.relativePath) {
      return SchemeUriHelper.create(this.scheme, props.relativePath)
    }

    if (props.fullPath) {
      const workspaceFolder = getWorkspaceFolder()
      const relativePath = SchemeUriHelper.relative(
        workspaceFolder.uri.fsPath,
        props.fullPath
      )
      return SchemeUriHelper.create(this.scheme, relativePath)
    }

    throw new Error('No relative path or full path provided')
  }
}

export const workspaceSchemeHandler = new WorkspaceSchemeHandler()
