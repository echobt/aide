/* eslint-disable unused-imports/no-unused-vars */
import { FC } from 'react'
import { toString } from 'mdast-util-to-string'

import type { MDElementProps } from '../types'
import { InlineCodeBlock } from './inline-code-block'

export const Code: FC<MDElementProps<'code'>> = ({
  children,
  node,
  ...elProps
}) => {
  const content = toString(node?.children)

  if (!content) return null

  return <InlineCodeBlock content={content} {...elProps} />
}
