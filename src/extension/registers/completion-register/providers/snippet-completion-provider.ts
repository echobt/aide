import { logger } from '@extension/logger'
import * as vscode from 'vscode'

import { CompletionHandler } from '../core/completion-handler'
import { CompletionUtils } from '../core/completion-utils'
import { SuggestionTrigger, type CompletionSuggestion } from '../core/types'

/**
 * Provider for snippet completions
 */
export class SnippetCompletionProvider
  implements vscode.CompletionItemProvider
{
  private disposables: vscode.Disposable[] = []

  constructor(private readonly completionHandler: CompletionHandler) {}

  /**
   * Provide completion items
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionList | null> {
    // Use the completion handler to get completion results
    const handlerResult = await this.completionHandler.handleCompletionRequest(
      document,
      position,
      SuggestionTrigger.Automatic,
      token
    )

    // If no result or not successful, return null
    if (!handlerResult || !handlerResult.success) {
      return null
    }

    try {
      // Create completion items from suggestions
      const items = handlerResult.suggestions.map((suggestion, index) =>
        this.createSnippetCompletionItem(
          suggestion,
          document,
          position,
          index,
          handlerResult.completionResult?.detailMessage || 'AI Suggestion'
        )
      )

      // Return completion list with items
      return new vscode.CompletionList(items, true)
    } catch (error) {
      logger.error('Error providing snippet completion items', error)
      return null
    }
  }

  /**
   * Create snippet completion item
   */
  private createSnippetCompletionItem(
    suggestion: CompletionSuggestion,
    document: vscode.TextDocument,
    position: vscode.Position,
    index: number,
    detailMessage: string
  ): vscode.CompletionItem {
    // Create completion item
    const item = new vscode.CompletionItem(
      suggestion.newBeforeCursorText,
      CompletionUtils.mapKindToVSCodeKind(
        suggestion.completionMetadata?.completionKind
      )
    )

    // Set item properties
    item.insertText = suggestion.guessCompletionText
    item.detail = `${detailMessage} ${index + 1}`
    item.filterText = suggestion.newBeforeCursorText
    item.sortText = `0${index}`.padStart(5, '0')
    item.preselect = index === 0

    // Set documentation
    if (suggestion.completionMetadata?.snippetContext) {
      item.documentation = new vscode.MarkdownString(
        suggestion.completionMetadata.snippetContext
      )
    }

    return item
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
