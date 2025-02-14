/* eslint-disable unused-imports/no-unused-vars */
import type { FC } from 'react'

import { Thinking } from './thinking'
import { V1Project } from './v1project'

export const customComponents: Record<string, FC<any>> = {
  v1project: V1Project,
  thinking: Thinking
}

export const customComponentTagNames = Object.keys(customComponents)
