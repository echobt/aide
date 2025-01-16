import { t } from '@extension/i18n'
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

  // eslint-disable-next-line unused-imports/no-unused-vars
  resolveBaseUriSync(uri: string): string {
    return SchemeUriHelper.create(this.scheme, '')
  }

  async resolveBaseUriAsync(uri: string): Promise<string> {
    return this.resolveBaseUriSync(uri)
  }

  resolveBasePathSync(): string {
    const workspaceFolder = getWorkspaceFolder()
    if (!workspaceFolder) throw new Error(t('error.noWorkspace'))

    return toUnixPath(workspaceFolder.uri.fsPath)
  }

  async resolveBasePathAsync(): Promise<string> {
    return this.resolveBasePathSync()
  }

  resolveRelativePathSync(uri: string): string {
    const uriHelper = new SchemeUriHelper(uri)
    return uriHelper.getPath() || './'
  }

  async resolveRelativePathAsync(uri: string): Promise<string> {
    return this.resolveRelativePathSync(uri)
  }

  resolveFullPathSync(uri: string): string {
    const basePath = this.resolveBasePathSync()
    const relativePath = this.resolveRelativePathSync(uri)
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
      if (!workspaceFolder) throw new Error(t('error.noWorkspace'))

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
