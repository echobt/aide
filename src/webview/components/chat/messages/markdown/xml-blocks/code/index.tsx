/* eslint-disable unused-imports/no-unused-vars */
import { FC } from 'react'

import { useBlockOriginalContent } from '../../hooks/use-block-original-content'
import type { MDElementProps } from '../types'
import { InlineCodeBlock } from './inline-code-block'

export const Code: FC<MDElementProps<'code'>> = ({
  children,
  node,
  ...elProps
}) => {
  const content = useBlockOriginalContent(node)

  if (!content) return null

  return <InlineCodeBlock content={content} {...elProps} />
}
