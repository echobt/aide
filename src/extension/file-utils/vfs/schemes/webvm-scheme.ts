import { aidePaths } from '@extension/file-utils/paths'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// webvm://<projectId>/<presetName>/<relativePath>
export class WebVMSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.WebVM)
  }

  private async getWebVMPath(
    projectId: string,
    presetName: string
  ): Promise<string> {
    const webVMPath = await aidePaths.getWebVMPath()
    return SchemeUriHelper.join(webVMPath, projectId, presetName)
  }

  resolveBaseUriSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectId, presetName] = uriHelper.getPathSegments()

    if (!projectId && !skipValidateError)
      throw new Error('Invalid webvm URI: missing project id')
    if (!presetName && !skipValidateError)
      throw new Error('Invalid webvm URI: missing preset name')

    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(projectId || '', presetName || '')
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
    const [projectId, presetName] = uriHelper.getPathSegments()

    if (!projectId && !skipValidateError)
      throw new Error('Invalid webvm URI: missing project id')
    if (!presetName && !skipValidateError)
      throw new Error('Invalid webvm URI: missing preset name')

    const webVMPath = await this.getWebVMPath(projectId || '', presetName || '')
    return webVMPath
  }

  resolveRelativePathSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [projectId, presetName, ...relativePathParts] =
      uriHelper.getPathSegments()

    if (!projectId && !skipValidateError)
      throw new Error('Invalid webvm URI: missing project id')
    if (!presetName && !skipValidateError)
      throw new Error('Invalid webvm URI: missing preset name')

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
    projectId: string
    presetName: string
    relativePath: string
  }): string {
    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(
        props.projectId,
        props.presetName,
        props.relativePath
      )
    )
  }
}

export const webvmSchemeHandler = new WebVMSchemeHandler()
