import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import * as vscode from 'vscode'

import { CompletionUtils } from '../core/completion-utils'

/**
 * TabOverrideHandler manages the tab key behavior for inline completions.
 * It handles the suggestion acceptance and command execution when tab key is pressed.
 */
export class TabOverrideHandler {
  private isInitialized: boolean = false

  private initPromise: Promise<void> | null = null

  /**
   * The current look-ahead suggestion that can be accepted with tab key
   */
  private currentLookAheadSuggestion:
    | vscode.InlineCompletionItem
    | undefined
    | null = null

  /**
   * Collection of disposables for cleanup
   */
  private disposables: vscode.Disposable[] = []

  /**
   * Clears the current look-ahead suggestion
   */
  clearCurrentLookAheadSuggestion(): void {
    this.currentLookAheadSuggestion = undefined
  }

  /**
   * Sets the current look-ahead suggestion
   * @param suggestion - The inline completion item to set as current suggestion
   */
  setCurrentLookAheadSuggestion(
    suggestion: vscode.InlineCompletionItem | undefined | null
  ): void {
    this.currentLookAheadSuggestion = suggestion
  }

  /**
   * Gets the current look-ahead suggestion
   * @returns The current inline completion item
   */
  getCurrentLookAheadSuggestion():
    | vscode.InlineCompletionItem
    | undefined
    | null {
    return this.currentLookAheadSuggestion
  }

  /**
   * Initializes the tab key override functionality
   */
  async init(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    // eslint-disable-next-line no-async-promise-executor
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        // Enable tab override context and register the command
        const contextDisposable = await this.enableTabOverrideContext()
        const commandDisposable = this.registerTabOverride()
        // Track for cleanup
        this.disposables.push(contextDisposable, commandDisposable)
        this.isInitialized = true
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Registers the tab override command
   * @returns A disposable for the registered command
   */
  private registerTabOverride(): vscode.Disposable {
    return vscode.commands.registerTextEditorCommand(
      'aide.tab-override',
      async (textEditor: vscode.TextEditor) => {
        // If no suggestion is available, fall back to default behavior
        if (!this.currentLookAheadSuggestion) {
          await vscode.commands.executeCommand('acceptSelectedSuggestion')
          return
        }

        const { range, insertText, command } = this.currentLookAheadSuggestion

        // Apply the suggestion if it has valid range and text
        if (range && insertText) {
          try {
            // Create and insert the snippet
            const snippetString = new vscode.SnippetString(
              typeof insertText === 'string'
                ? CompletionUtils.escapeTabStopSign(insertText)
                : insertText.value
            )

            await textEditor.insertSnippet(snippetString, range)

            // Execute any associated command (like auto-import)
            if (command) {
              await this.executeCommand(command)
            }
          } catch (error) {
            logger.error('Error applying tab override:', error)
          }
        }

        // Always clear the suggestion after handling
        this.clearCurrentLookAheadSuggestion()
      }
    )
  }

  /**
   * Executes a VS Code command with its arguments
   * @param command - The command to execute
   */
  private async executeCommand(command: vscode.Command): Promise<void> {
    await vscode.commands.executeCommand(
      command.command,
      ...(command.arguments || [])
    )
  }

  /**
   * Enables the tab override context in VS Code
   * @returns A disposable to clean up the context
   */
  private async enableTabOverrideContext(): Promise<vscode.Disposable> {
    // Set the context flag to enable tab override
    await vscode.commands.executeCommand(
      'setContext',
      'aide.tab-override',
      true
    )

    // Return a disposable to reset the context when disposed
    return {
      dispose() {
        vscode.commands.executeCommand(
          'setContext',
          'aide.tab-override',
          undefined
        )
      }
    }
  }

  /**
   * Disposes all resources held by this handler
   */
  async dispose(): Promise<void> {
    // Dispose all registered disposables
    await settledPromiseResults(
      this.disposables.map(async disposable => await disposable.dispose())
    )

    // Clear the disposables array
    this.disposables = []
    this.isInitialized = false
    this.initPromise = null
  }
}
