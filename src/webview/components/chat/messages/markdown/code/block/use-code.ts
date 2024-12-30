export const FALLBACK_LANG = 'typescript'

export const useCode = (raw: any): { content: string; lang: string } => {
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
