import { UriScheme } from '@extension/file-utils/vfs/helpers/types'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

export type OptimizeSchemeUriRenderOptions = {
  /**
   * root name
   * @default 'ROOT'
   */
  rootName?: string
  /**
   * remove schemes
   * @default [UriScheme.Workspace]
   */
  removeSchemes?: UriScheme[]
}

export const optimizeSchemeUriRender = (
  schemeUri: string,
  options?: OptimizeSchemeUriRenderOptions
): string => {
  const rootName = options?.rootName || 'ROOT'
  const removeSchemes = options?.removeSchemes || [UriScheme.Workspace]

  const { scheme, path } = SchemeUriHelper.parse(schemeUri, false)
  const finalPath = path || rootName

  if (!scheme) return finalPath

  if (removeSchemes.includes(scheme as UriScheme)) {
    return finalPath
  }

  return SchemeUriHelper.create(scheme, finalPath)
}
