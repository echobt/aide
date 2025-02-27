import { logAndToastError } from '@webview/utils/common'
import type { TFunction } from 'i18next'
import { v4 as uuid } from 'uuid'

import { tryFixJson } from './validation'

export const minifyJsonString = (t: TFunction, jsonString: string): string => {
  try {
    return JSON.stringify(JSON.parse(jsonString))
  } catch {
    try {
      // Try to fix and minify if regular parse fails
      const fixed = tryFixJson(t, jsonString)
      return JSON.stringify(JSON.parse(fixed))
    } catch (error) {
      logAndToastError(t('webview.jsonEditor.failedToMinify'), error)
      return jsonString
    }
  }
}

export const prettifyJsonString = (
  t: TFunction,
  jsonString: string
): string => {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2)
  } catch {
    try {
      // Try to fix and prettify if regular parse fails
      const fixed = tryFixJson(t, jsonString)
      return JSON.stringify(JSON.parse(fixed), null, 2)
    } catch (error) {
      logAndToastError(t('webview.jsonEditor.failedToPrettify'), error)
      return jsonString
    }
  }
}

export const downloadJsonFile = (jsonString: string, filename?: string) => {
  const fileName = filename || `json-${uuid()}`
  const blob = new Blob([jsonString], { type: 'application/json' })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${fileName}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

// Add function to check if string is valid JSON
export const isValidJson = (jsonString: string): boolean => {
  try {
    JSON.parse(jsonString)
    return true
  } catch {
    return false
  }
}

// Add function to get line and column from error message
export const getErrorPosition = (
  error: Error
): { line: number; column: number } => {
  const match = error.message.match(/at position (\d+)/)
  if (match) {
    const pos = parseInt(match[1]!, 10)
    const lines = error.message.slice(0, pos).split('\n')
    return {
      line: lines.length,
      column: lines[lines.length - 1]?.length ?? 0
    }
  }
  return { line: 0, column: 0 }
}
