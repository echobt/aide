import * as path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { getWorkspaceFolder } from '@extension/utils'
import * as vscode from 'vscode'

import {
  completionConfig,
  dependenciesFiles,
  extensionToLanguage,
  languageExtensions,
  snippetCompletionTriggers
} from './constants'
import { CompletionSuggestion } from './types'

/**
 * Utility functions for completion functionality
 */
export class CompletionUtils {
  /**
   * escape tab stop sign in code snippet
   */
  static escapeTabStopSign(text: string): string {
    return text.replace(/\$/g, '\\$')
  }

  /**
   * Check if completion is allowed for the current document and position
   */
  static isCompletionAllowed(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // // Skip completion for comments
    const lineText = document.lineAt(position.line).text
    // const commentStart = lineText.indexOf('//')
    // if (commentStart >= 0 && position.character > commentStart) {
    //   return false
    // }

    // Skip completion for strings
    const textBeforeCursor = lineText.substring(0, position.character)
    const isInString = this.isPositionInString(textBeforeCursor)
    if (isInString) {
      return false
    }

    return true
  }

  /**
   * Check if position is valid for inline completion
   */
  static isValidInlinePosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // Skip if at end of file
    if (
      position.line === document.lineCount - 1 &&
      position.character === document.lineAt(position.line).text.length
    ) {
      return false
    }

    // Skip if line is empty
    if (document.lineAt(position.line).text.trim() === '') {
      return false
    }

    return true
  }

  /**
   * Check if we should show fewer suggestions
   */
  static shouldShowFewSuggestions(
    response: { oldPrefix: string } | null | undefined,
    document: vscode.TextDocument
  ): boolean {
    if (!response) {
      return false
    }

    // Show fewer suggestions for short prefixes
    if (response.oldPrefix.length < 3) {
      return true
    }

    // Show fewer suggestions for certain file types
    const fileExtension = this.getLanguageFileExtension(document.languageId)
    if (fileExtension && ['.md', '.txt'].includes(fileExtension)) {
      return true
    }

    return false
  }

  /**
   * Get file extension for language
   */
  static getLanguageFileExtension(languageId: string): string | undefined {
    return languageExtensions[languageId]
  }

  /**
   * Get language from file extension
   */
  static getLanguageFromExtension(extension: string): string {
    return extensionToLanguage[extension.toLowerCase()] || 'plaintext'
  }

  /**
   * Get language from filename
   */
  static getLanguageFromFilename(filename: string): string {
    const extension = path.extname(filename).toLowerCase()
    return this.getLanguageFromExtension(extension)
  }

  /**
   * Get file name with extension
   */
  static getFileNameWithExtension(document: vscode.TextDocument): string {
    const fileName = path.basename(document.fileName)

    if (path.extname(fileName)) {
      return fileName
    }

    const extension = this.getLanguageFileExtension(document.languageId)
    return extension ? `${fileName}${extension}` : fileName
  }

  /**
   * Get tab size for the current editor
   */
  static getTabSize(): number {
    const config = vscode.workspace.getConfiguration('editor')
    const tabSize = config.get<number>('tabSize')
    return tabSize || 4
  }

  /**
   * Get dependencies file path
   */
  static async getDependenciesFilePath(
    languageId: string
  ): Promise<string | undefined> {
    const workspaceFolder = getWorkspaceFolder()
    if (!workspaceFolder) {
      return undefined
    }

    const files = dependenciesFiles[languageId] || []

    for (const file of files) {
      const filePath = path.join(workspaceFolder.uri.fsPath, file)
      if (await vfs.isExists(filePath)) {
        return filePath
      }
    }

    return undefined
  }

  /**
   * Check if position is inside a string
   */
  private static isPositionInString(textBeforeCursor: string): boolean {
    let inSingleQuote = false
    let inDoubleQuote = false
    let inBacktick = false
    let escaped = false

    for (let i = 0; i < textBeforeCursor.length; i++) {
      const char = textBeforeCursor[i]

      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote
      } else if (char === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick
      }
    }

    return inSingleQuote || inDoubleQuote || inBacktick
  }

  /**
   * Extract detail message from completion response
   */
  static extractDetailMessage(response: any): string {
    if (!response) {
      return ''
    }

    return response.detailMessage || 'AI Suggestion'
  }

  /**
   * Map completion kind to VSCode completion item kind
   */
  static mapKindToVSCodeKind(
    kind?: string
  ): vscode.CompletionItemKind | undefined {
    if (!kind) {
      return undefined
    }

    const kindMap: Record<string, vscode.CompletionItemKind> = {
      method: vscode.CompletionItemKind.Method,
      function: vscode.CompletionItemKind.Function,
      constructor: vscode.CompletionItemKind.Constructor,
      field: vscode.CompletionItemKind.Field,
      variable: vscode.CompletionItemKind.Variable,
      class: vscode.CompletionItemKind.Class,
      interface: vscode.CompletionItemKind.Interface,
      module: vscode.CompletionItemKind.Module,
      property: vscode.CompletionItemKind.Property,
      unit: vscode.CompletionItemKind.Unit,
      value: vscode.CompletionItemKind.Value,
      enum: vscode.CompletionItemKind.Enum,
      keyword: vscode.CompletionItemKind.Keyword,
      snippet: vscode.CompletionItemKind.Snippet,
      color: vscode.CompletionItemKind.Color,
      file: vscode.CompletionItemKind.File,
      reference: vscode.CompletionItemKind.Reference,
      folder: vscode.CompletionItemKind.Folder,
      enummember: vscode.CompletionItemKind.EnumMember,
      constant: vscode.CompletionItemKind.Constant,
      struct: vscode.CompletionItemKind.Struct,
      event: vscode.CompletionItemKind.Event,
      operator: vscode.CompletionItemKind.Operator,
      typeparameter: vscode.CompletionItemKind.TypeParameter
    }

    return kindMap[kind.toLowerCase()] || vscode.CompletionItemKind.Text
  }

  /**
   * Get completion info without overlapping dot
   */
  static getCompletionInfoWithoutOverlappingDot(
    currentSelectedText: string
  ): string {
    return currentSelectedText.startsWith('.')
      ? currentSelectedText.substring(1)
      : currentSelectedText
  }

  /**
   * Check if a trigger character should trigger completion
   */
  static isTriggerCharacter(char: string): boolean {
    return snippetCompletionTriggers.includes(char)
  }

  /**
   * Get text before cursor
   */
  static getTextBeforeCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const lineText = document.lineAt(position.line).text
    return lineText.substring(0, position.character)
  }

  /**
   * Get text after cursor
   */
  static getTextAfterCursor(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const lineText = document.lineAt(position.line).text
    return lineText.substring(position.character)
  }

  /**
   * Get context for completion
   */
  static getCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    maxChars: number = completionConfig.charLimit
  ): {
    beforeCursorText: string
    afterCursorText: string
    lineTextBeforeCursor: string
    lineTextAfterCursor: string
  } {
    // Get text before cursor (limited by maxChars)
    let beforeText = ''
    let { line } = position
    let char = position.character

    // Get current line text for lineTextBeforeCursor and lineTextAfterCursor
    const currentLineText = document.lineAt(position.line).text
    const lineTextBeforeCursor = currentLineText.substring(
      0,
      position.character
    )
    const lineTextAfterCursor = currentLineText.substring(position.character)

    while (beforeText.length < maxChars && line >= 0) {
      const lineText = document.lineAt(line).text

      if (line === position.line) {
        beforeText = lineText.substring(0, char) + beforeText
      } else {
        beforeText = `${lineText}\n${beforeText}`
      }

      line--
      if (line >= 0) {
        char = document.lineAt(line).text.length
      }

      if (beforeText.length > maxChars) {
        beforeText = beforeText.substring(beforeText.length - maxChars)
      }
    }

    // Get text after cursor (limited by remaining maxChars)
    let afterText = ''
    line = position.line
    char = position.character
    const remainingChars = maxChars - beforeText.length

    while (afterText.length < remainingChars && line < document.lineCount) {
      const lineText = document.lineAt(line).text

      if (line === position.line) {
        afterText += lineText.substring(char)
      } else {
        afterText += `\n${lineText}`
      }

      line++
      char = 0

      if (afterText.length > remainingChars) {
        afterText = afterText.substring(0, remainingChars)
      }
    }

    return {
      beforeCursorText: beforeText,
      afterCursorText: afterText,
      lineTextBeforeCursor,
      lineTextAfterCursor
    }
  }

  /**
   * Format completion results for display
   */
  static formatCompletionResults(
    results: CompletionSuggestion[]
  ): CompletionSuggestion[] {
    if (!results || results.length === 0) {
      return []
    }

    // Remove duplicates
    const uniqueResults = results.filter(
      (result, index, self) =>
        index ===
        self.findIndex(
          r => r.newBeforeCursorText === result.newBeforeCursorText
        )
    )

    // Sort by score (if available)
    return uniqueResults.sort((a, b) => {
      if (
        a.completionMetadata?.score !== undefined &&
        b.completionMetadata?.score !== undefined
      ) {
        return b.completionMetadata.score - a.completionMetadata.score
      }
      return 0
    })
  }

  /**
   * Debounce function for completion requests
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = completionConfig.debounceDelay
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    // eslint-disable-next-line func-names
    return function (this: any, ...args: Parameters<T>): void {
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        func.apply(this, args)
      }, wait)
    }
  }

  /**
   * Check if enough time has passed since last completion
   */
  static hasEnoughTimePassed(
    lastCompletionTime: number,
    minTime: number = completionConfig.minTimeBetweenCompletions
  ): boolean {
    const now = Date.now()
    return now - lastCompletionTime >= minTime
  }
}
