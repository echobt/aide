import { escapeBrackets, escapeMhchem, fixMarkdownBold } from './common'

export const fixMarkdownContent = (content: string) =>
  fixMarkdownBold(escapeMhchem(escapeBrackets(content)))
