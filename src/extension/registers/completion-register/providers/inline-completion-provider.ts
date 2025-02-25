import * as vscode from 'vscode'

import { CompletionHandler } from '../core/completion-handler'
import { CompletionState } from '../core/completion-state'
import { AutocompleteResult, SuggestionTrigger } from '../core/types'
import { AutoImportHandler } from './auto-import-handler'
import { AideInlineCompletionItem } from './inline-completion-item'
import { TabOverrideHandler } from './tab-override-handler'

/**
 * Provider for inline completions
 */
export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private disposables: vscode.Disposable[] = []

  constructor(
    private readonly completionState: CompletionState,
    private readonly completionHandler: CompletionHandler,
    private readonly autoImportHandler: AutoImportHandler,
    private readonly tabOverrideHandler: TabOverrideHandler
  ) {}

  /**
   * Provide inline completion items
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    // Use the completion handler to get completion results
    const handlerResult = await this.completionHandler.handleCompletionRequest(
      document,
      position,
      SuggestionTrigger.LookAhead,
      token
    )

    // If no result or not successful, return null
    if (!handlerResult || !handlerResult.success) {
      this.tabOverrideHandler.clearCurrentLookAheadSuggestion()
      return null
    }

    // Check if we should reuse the last result
    if (handlerResult.reuseLastResult && handlerResult.lastResult) {
      return handlerResult.lastResult
    }

    // Create inline completion list
    const completionList = this.createInlineCompletionList(
      handlerResult.completionResult,
      document,
      position
    )

    // Handle the completion list
    return this.handleCompletionList(completionList, document, position)
  }

  /**
   * Handle the created completion list
   */
  private handleCompletionList(
    completionList: vscode.InlineCompletionList | null,
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | null {
    const firstItem = completionList?.items?.[0]

    console.log('firstItem', firstItem)
    if (!firstItem) {
      this.tabOverrideHandler.clearCurrentLookAheadSuggestion()
      return null
    }

    // Update tab override handler
    this.tabOverrideHandler.setCurrentLookAheadSuggestion(firstItem)

    // Save the request result for future reuse
    this.completionState.saveLastRequest(document, position, completionList)

    return completionList
  }

  /**
   * Create inline completion list from completion result
   */
  private createInlineCompletionList(
    response: AutocompleteResult | null,
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | null {
    if (!response || response.suggestions.length === 0) {
      return null
    }

    const items = response.suggestions.map(entry => {
      // directly use the original guessCompletionText, without trying to determine word boundaries
      // this ensures correct completion, with VSCode handling the insertion logic
      const item = new AideInlineCompletionItem(
        entry.guessCompletionText,
        entry,
        // provide the simplest Range: insert at the cursor position
        new vscode.Range(position, position),
        this.autoImportHandler.createImportCommand(
          entry.imports,
          position,
          SuggestionTrigger.LookAhead
        ),
        entry.completionMetadata?.completionKind,
        entry.completionMetadata?.isCached,
        entry.completionMetadata?.snippetContext
      )

      return item
    })

    return new vscode.InlineCompletionList(items)
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.tabOverrideHandler?.dispose()

    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
