import * as vscode from 'vscode'

import { CompletionSuggestion } from '../core/types'

/**
 * Custom inline completion item
 */
export class AideInlineCompletionItem extends vscode.InlineCompletionItem {
  constructor(
    insertText: string,
    public readonly entry: CompletionSuggestion,
    range: vscode.Range,
    public readonly command?: vscode.Command,
    public readonly kind?: string,
    public readonly isCached?: boolean,
    public readonly snippetContext?: string
  ) {
    super(insertText, range)
  }
}
