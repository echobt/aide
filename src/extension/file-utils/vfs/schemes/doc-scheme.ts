import { DocCrawler } from '@extension/chat/utils/doc-crawler'
import { docSitesDB } from '@extension/lowdb/doc-sites-db'
import { toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { UriScheme } from '../helpers/types'
import { BaseSchemeHandler } from '../helpers/utils'

// doc://<siteName>/<relativePath>
export class DocSchemeHandler extends BaseSchemeHandler {
  constructor() {
    super(UriScheme.Doc)
  }

  private async getDocPath(siteName: string): Promise<string> {
    const sites = await docSitesDB.getAll()
    const site = sites.find(s => s.name === siteName)
    if (!site) throw new Error(`Site: ${siteName} not found`)

    const docCrawlerPath = await DocCrawler.getDocCrawlerFolderPath(site.url)
    return toUnixPath(docCrawlerPath)
  }

  resolveBaseUriSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [siteName] = uriHelper.getPathSegments()

    if (!siteName && !skipValidateError)
      throw new Error('Invalid doc URI: missing site name')

    return SchemeUriHelper.create(this.scheme, siteName || '')
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
    const [siteName] = uriHelper.getPathSegments()

    if (!siteName && !skipValidateError)
      throw new Error('Invalid doc URI: missing site name')

    const docPath = await this.getDocPath(siteName || '')
    return docPath
  }

  resolveRelativePathSync(uri: string, skipValidateError?: boolean): string {
    const uriHelper = new SchemeUriHelper(uri)
    const [siteName, ...relativePathParts] = uriHelper.getPathSegments()

    if (!siteName && !skipValidateError)
      throw new Error('Invalid doc URI: missing site name')

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

  createSchemeUri(props: { siteName: string; relativePath: string }): string {
    return SchemeUriHelper.create(
      this.scheme,
      SchemeUriHelper.join(props.siteName, props.relativePath)
    )
  }
}

export const docSchemeHandler = new DocSchemeHandler()
