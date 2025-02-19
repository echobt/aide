import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import { UriScheme } from '@webview/types/chat'

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

  /**
   * remove path prefix part, only working when scheme is not displayed
   * @default 0
   */
  removePathPrefixPart?: number
}

export const optimizeSchemeUriRender = (
  schemeUri: string,
  options?: OptimizeSchemeUriRenderOptions
): string => {
  const rootName = options?.rootName || 'ROOT'
  const removeSchemes = options?.removeSchemes || [UriScheme.Workspace]
  const removePathPrefixPart = options?.removePathPrefixPart || 0
  const { scheme, path } = SchemeUriHelper.parse(schemeUri, false)
  const finalPath = path || rootName
  const removePrefix = (path: string) => {
    if (removePathPrefixPart === 0) return path
    const paths = path.split('/')
    return paths.slice(removePathPrefixPart).join('/')
  }

  if (!scheme) return removePrefix(finalPath)

  if (removeSchemes.includes(scheme as UriScheme)) {
    return removePrefix(finalPath)
  }

  return SchemeUriHelper.create(scheme, finalPath)
}
