import { settledPromiseResults } from '@shared/utils/common'
import * as vscode from 'vscode'

import { BaseRegister } from '../base-register'
import { CompletionHandler } from './core/completion-handler'
import { CompletionService } from './core/completion-service'
import { CompletionState } from './core/completion-state'
import { snippetCompletionTriggers } from './core/constants'
import { AutoImportHandler } from './providers/auto-import-handler'
import { InlineCompletionProvider } from './providers/inline-completion-provider'
import { SnippetCompletionProvider } from './providers/snippet-completion-provider'
import { TabOverrideHandler } from './providers/tab-override-handler'

/**
 * Register for code completion functionality
 */
export class CompletionRegister extends BaseRegister {
  // Core services
  private completionState!: CompletionState

  private completionService!: CompletionService

  private autoImportHandler!: AutoImportHandler

  private tabOverrideHandler!: TabOverrideHandler

  private completionHandler!: CompletionHandler

  // Providers
  private inlineCompletionProvider: InlineCompletionProvider | null = null

  private snippetCompletionProvider: SnippetCompletionProvider | null = null

  // Disposables
  private inlineCompletionDisposables: vscode.Disposable[] = []

  private snippetCompletionDisposables: vscode.Disposable[] = []

  protected disposables: vscode.Disposable[] = []

  /**
   * Register completion functionality
   */
  async register(): Promise<void> {
    // Initialize core services
    this.completionState = new CompletionState()
    this.completionService = new CompletionService(this.completionState)
    this.autoImportHandler = new AutoImportHandler()
    this.tabOverrideHandler = new TabOverrideHandler()
    this.completionHandler = new CompletionHandler(
      this.completionState,
      this.completionService
    )

    // Register providers
    await this.registerInlineCompletionProvider()
    // await this.registerSnippetCompletionProvider()
  }

  /**
   * Register inline completion provider
   */
  private async registerInlineCompletionProvider(): Promise<void> {
    await this.unregisterInlineCompletionProvider()
    await this.tabOverrideHandler.init()

    // Create and register provider
    this.inlineCompletionProvider = new InlineCompletionProvider(
      this.completionState,
      this.completionHandler,
      this.autoImportHandler,
      this.tabOverrideHandler
    )

    this.inlineCompletionDisposables.push(
      vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        this.inlineCompletionProvider
      )
    )
  }

  /**
   * Register snippet completion provider
   */
  private async registerSnippetCompletionProvider(): Promise<void> {
    await this.unregisterSnippetCompletionProvider()

    // Create and register provider
    this.snippetCompletionProvider = new SnippetCompletionProvider(
      this.completionHandler
    )

    this.snippetCompletionDisposables.push(
      vscode.languages.registerCompletionItemProvider(
        { pattern: '**' },
        this.snippetCompletionProvider,
        ...snippetCompletionTriggers
      ),

      // Register command for toggling completions
      vscode.commands.registerCommand('aide.toggleCompletions', () => {
        this.completionService.requestToggle()
      })
    )
  }

  /**
   * Unregister inline completion provider
   */
  private async unregisterInlineCompletionProvider(): Promise<void> {
    await this.disposeAll(this.inlineCompletionDisposables)
    await this.tabOverrideHandler.dispose()
    this.inlineCompletionDisposables = []

    if (this.inlineCompletionProvider) {
      this.inlineCompletionProvider.dispose()
      this.inlineCompletionProvider = null
    }
  }

  /**
   * Unregister snippet completion provider
   */
  private async unregisterSnippetCompletionProvider(): Promise<void> {
    await this.disposeAll(this.snippetCompletionDisposables)
    this.snippetCompletionDisposables = []

    if (this.snippetCompletionProvider) {
      this.snippetCompletionProvider.dispose()
      this.snippetCompletionProvider = null
    }
  }

  /**
   * Helper to dispose all disposables in an array
   */
  private async disposeAll(disposables: vscode.Disposable[]): Promise<void> {
    await settledPromiseResults(
      disposables.map(async disposable => await disposable.dispose())
    )
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    await settledPromiseResults([
      this.unregisterInlineCompletionProvider(),
      this.unregisterSnippetCompletionProvider(),
      this.tabOverrideHandler.dispose(),
      Promise.resolve(this.completionHandler.dispose()),
      Promise.resolve(this.completionService.dispose()),
      Promise.resolve(this.completionState.dispose()),
      Promise.resolve(this.autoImportHandler.dispose())
    ])

    await this.disposeAll(this.disposables)
    this.disposables = []
  }
}
