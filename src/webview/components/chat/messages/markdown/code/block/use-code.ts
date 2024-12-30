export const FALLBACK_LANG = 'typescript'

export const useCode = (_children: any): { content: string; lang: string } => {
  const raw = Array.isArray(_children) ? _children[0] : _children

  if (!raw) return { content: '', lang: FALLBACK_LANG }

  const { children, className } = raw.props

  if (!children) return { content: '', lang: FALLBACK_LANG }

  const content = Array.isArray(children) ? (children[0] as string) : children
  const lang = className?.replace('language-', '') || FALLBACK_LANG

  return {
    content,
    lang
  }
}
