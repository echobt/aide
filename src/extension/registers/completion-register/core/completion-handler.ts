import { logger } from '@extension/logger'
import * as vscode from 'vscode'

import { CompletionService } from './completion-service'
import { CompletionState } from './completion-state'
import { CompletionUtils } from './completion-utils'
import {
  AutocompleteResult,
  CompletionSuggestion,
  DebounceConfig,
  DocumentChangesState,
  SuggestionTrigger
} from './types'

/**
 * Result from the completion handler
 */
export interface CompletionHandlerResult {
  // The raw completion result
  completionResult: AutocompleteResult | null

  // The suggestions from the completion result
  suggestions: CompletionSuggestion[]

  // Whether the completion was successful
  success: boolean

  // Whether to reuse the last result (for inline completions)
  reuseLastResult?: boolean

  // The last result to reuse (for inline completions)
  lastResult?: vscode.InlineCompletionList
}

/**
 * Handler for completion requests
 * This class centralizes the logic for handling completion requests
 * and can be used by both inline and snippet completion providers
 */
export class CompletionHandler {
  // Debounce related properties
  private debounceConfig: DebounceConfig = {
    delay: 200,
    maxWait: 1000
  }

  private debounceTimer: NodeJS.Timeout | null = null

  private completionTimer: NodeJS.Timeout | null = null

  private lastInputTime: number = Date.now()

  private lastCompletionAttemptTime: number = 0

  private isTyping: boolean = false

  private pendingCompletion: boolean = false

  private disposables: vscode.Disposable[] = []

  private documentChanges: DocumentChangesState = {
    lastChangeTime: Date.now(),
    lastCompletionTime: 0
  }

  constructor(
    private readonly completionState: CompletionState,
    private readonly completionService: CompletionService
  ) {
    // Subscribe to document change events
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        this.onDidChangeTextDocument.bind(this)
      )
    )
  }

  /**
   * Handle document change events
   */
  private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
    // If there is no active editor, return directly
    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor) return

    // If the changed document is not the current active document, return directly
    if (
      event.document.uri.toString() !== activeEditor.document.uri.toString()
    ) {
      return
    }

    // Get the current cursor position
    const position = activeEditor.selection.active

    // Check if the change is user input
    const isUserInput = event.contentChanges.some(change => {
      // Check if the change is near the cursor
      const changeStartLine = change.range.start.line
      const changeEndLine = change.range.end.line

      return changeStartLine <= position.line && changeEndLine >= position.line
    })

    if (isUserInput) {
      const now = Date.now()
      this.lastInputTime = now
      this.isTyping = true
      this.pendingCompletion = true

      // Update document changes state
      this.documentChanges = {
        ...this.documentChanges,
        lastChangeTime: now,
        lastPosition: position,
        lastDocument: event.document
      }

      // Clear any existing timers
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      if (this.completionTimer) {
        clearTimeout(this.completionTimer)
      }

      // Set a timer to detect when user stops typing
      this.debounceTimer = setTimeout(() => {
        this.isTyping = false
        this.debounceTimer = null

        // Schedule a completion attempt after the user stops typing
        this.scheduleCompletionAttempt(event.document, position)
      }, this.debounceConfig.delay)
    }
  }

  /**
   * Schedule a completion attempt after the user stops typing
   * This ensures that completion will be triggered even if VSCode doesn't request it
   */
  private scheduleCompletionAttempt(
    document: vscode.TextDocument,
    position: vscode.Position
  ): void {
    // Only schedule if we have a pending completion
    if (!this.pendingCompletion) return

    // Clear any existing completion timer
    if (this.completionTimer) {
      clearTimeout(this.completionTimer)
    }

    // Set a timer to attempt completion
    this.completionTimer = setTimeout(async () => {
      this.completionTimer = null

      // Only proceed if we're still pending and not typing
      if (this.pendingCompletion && !this.isTyping) {
        this.pendingCompletion = false
        this.lastCompletionAttemptTime = Date.now()

        try {
          // Get the active editor and position
          const activeEditor = vscode.window.activeTextEditor
          if (
            !activeEditor ||
            activeEditor.document.uri.toString() !== document.uri.toString()
          ) {
            return
          }

          // Check if the position has changed significantly
          const currentPosition = activeEditor.selection.active
          if (Math.abs(currentPosition.line - position.line) > 1) {
            return
          }

          // Manually trigger the inline completion provider
          await vscode.commands.executeCommand(
            'editor.action.inlineSuggest.trigger'
          )
        } catch (error) {
          logger.error('Error triggering completion:', error)
        }
      }
    }, this.debounceConfig.delay * 0.5) // Slightly shorter delay for completion attempt
  }

  /**
   * Check if should provide completion
   *
   * This method determines if completion should be provided based on:
   * 1. Whether the user is currently typing (no completion during active typing)
   * 2. Whether enough time has passed since the last input (allow completion after pause)
   */
  shouldComplete(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // If user is actively typing, don't provide completion
    if (this.isTyping) {
      return false
    }

    // If the last input was too recent, don't provide completion yet
    const timeSinceLastInput = Date.now() - this.lastInputTime
    if (timeSinceLastInput < this.debounceConfig.delay) {
      // Mark as pending so we can trigger it later
      this.pendingCompletion = true
      return false
    }

    // If position hasn't changed since last input but not enough time has passed,
    // don't provide completion yet
    if (this.documentChanges.lastPosition) {
      if (
        position.line === this.documentChanges.lastPosition.line &&
        position.character === this.documentChanges.lastPosition.character &&
        timeSinceLastInput < this.debounceConfig.delay * 2
      ) {
        // Mark as pending so we can trigger it later
        this.pendingCompletion = true
        return false
      }
    }

    // If we've recently attempted completion, allow it
    const timeSinceLastAttempt = Date.now() - this.lastCompletionAttemptTime
    if (timeSinceLastAttempt < this.debounceConfig.delay * 3) {
      this.pendingCompletion = false
      return true
    }

    // We're good to go
    this.pendingCompletion = false
    return true
  }

  /**
   * Handle a completion request
   * @param document The document to get completions for
   * @param position The position to get completions for
   * @param trigger The trigger type for the completion
   * @param token Optional cancellation token
   * @returns The completion handler result or null if completion should be skipped
   */
  async handleCompletionRequest(
    document: vscode.TextDocument,
    position: vscode.Position,
    trigger: SuggestionTrigger,
    _token?: vscode.CancellationToken
  ): Promise<CompletionHandlerResult | null> {
    // Check if completion is enabled
    if (!this.completionState.isEnabled) {
      return null
    }

    // For inline completions, check if we can reuse the last result
    if (
      trigger === SuggestionTrigger.LookAhead &&
      this.completionState.canReuseLastResult(document, position)
    ) {
      const lastResult = this.completionState.getLastRequestResult()
      if (lastResult) {
        // Create a result with reuse flags
        return {
          completionResult: null,
          suggestions: [],
          success: true,
          reuseLastResult: true,
          lastResult
        }
      }
    }

    // Check if completion should be provided
    if (!this.shouldProvideCompletion(document, position, trigger)) {
      return null
    }

    try {
      // Get completion result
      const result = await this.completionService.getCompletionResult(
        document,
        position,
        trigger
      )

      // If no suggestions, return null
      if (!result || result.suggestions.length === 0) {
        return null
      }

      // Get detail message from current results
      const detailMessage = CompletionUtils.extractDetailMessage(
        this.completionState.currentResults
      )

      // Create completion result
      const completionResult: AutocompleteResult = {
        ...result,
        detailMessage
      }

      // Update last completion time
      this.documentChanges.lastCompletionTime = Date.now()
      this.lastCompletionAttemptTime = Date.now()

      return {
        completionResult,
        suggestions: result.suggestions,
        success: true
      }
    } catch (error) {
      logger.error(`Error handling ${trigger} completion request:`, error)
      return null
    }
  }

  /**
   * Check if completion should be provided
   */
  private shouldProvideCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    trigger: SuggestionTrigger
  ): boolean {
    // Check if completion is enabled at all
    if (!this.completionState.isEnabled) {
      return false
    }

    // Check if we should complete based on typing behavior
    if (!this.shouldComplete(document, position)) {
      return false
    }

    // Check trigger-specific conditions
    if (trigger === SuggestionTrigger.LookAhead) {
      // For look-ahead, check if inline completion is enabled
      if (!this.completionState.isInlineCompletionEnabled) {
        return false
      }

      // Check if position is valid for inline completion
      if (!CompletionUtils.isValidInlinePosition(document, position)) {
        return false
      }
    } else {
      // For other triggers, check if snippet completion is enabled
      if (!this.completionState.isSnippetCompletionEnabled) {
        return false
      }

      // Check if completion is allowed at this position
      if (!CompletionUtils.isCompletionAllowed(document, position)) {
        return false
      }
    }

    return true
  }

  /**
   * Set debounce configuration
   */
  setDebounceConfig(config: Partial<DebounceConfig>): void {
    this.debounceConfig = { ...this.debounceConfig, ...config }
  }

  /**
   * Get current debounce configuration
   */
  getDebounceConfig(): DebounceConfig {
    return this.debounceConfig
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Clear any existing timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.completionTimer) {
      clearTimeout(this.completionTimer)
      this.completionTimer = null
    }

    // Dispose all disposables
    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
