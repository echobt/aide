import * as vscode from 'vscode'

import {
  AutocompleteResult,
  DebounceConfig,
  DocumentChangesState,
  LastRequest,
  SuggestionTrigger
} from './types'

/**
 * Event types for completion state changes
 */
export enum CompletionStateEventType {
  StatusChanged = 'status-changed',
  ResultsChanged = 'results-changed',
  LockStateChanged = 'lock-state-changed',
  PositionChanged = 'position-changed',
  DocumentChanged = 'document-changed'
}

/**
 * Centralized state management for completion functionality
 */
export class CompletionState {
  // Event emitter
  private readonly eventEmitter = new vscode.EventEmitter<{
    type: CompletionStateEventType
    data?: any
  }>()

  // Public event
  readonly onStateChanged = this.eventEmitter.event

  // State properties
  private _isEnabled: boolean = true

  private _isSnippetCompletionEnabled: boolean = true

  private _isInlineCompletionEnabled: boolean = true

  private _currentResults: AutocompleteResult | null = null

  private _isLocked: boolean = false

  private _currentTrigger: SuggestionTrigger = SuggestionTrigger.Automatic

  private _statusMessage: string = ''

  private _documentChanges: DocumentChangesState = {
    lastChangeTime: Date.now(),
    lastCompletionTime: 0
  }

  private statusBarItem: vscode.StatusBarItem

  private disposables: vscode.Disposable[] = []

  // Debounce related properties
  private lastRequest: LastRequest | null = null

  private debounceConfig: DebounceConfig = {
    delay: 200,
    maxWait: 1000
  }

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    )
    this.statusBarItem.text = '$(sparkle) AIDE'
    this.statusBarItem.tooltip = 'AIDE Suggestions'
    this.statusBarItem.command = 'aide.toggleCompletions'
    this.statusBarItem.show()

    // Subscribe to state changes that affect status bar
    this.disposables.push(
      this.onStateChanged(event => {
        if (
          [
            CompletionStateEventType.StatusChanged,
            CompletionStateEventType.LockStateChanged
          ].includes(event.type)
        ) {
          this.updateCompletionStatus()
        }
      })
    )

    this.updateCompletionStatus()
  }

  /**
   * Update completion status in status bar
   */
  private updateCompletionStatus(): void {
    if (!this.statusBarItem) return

    if (!this._isEnabled) {
      this.statusBarItem.text = '$(stop) AIDE'
      this.statusBarItem.tooltip = 'AIDE Suggestions (Disabled)'
    } else if (this._isLocked) {
      this.statusBarItem.text = '$(lock) AIDE'
      this.statusBarItem.tooltip = 'AIDE Suggestions (Locked)'
    } else {
      this.statusBarItem.text = '$(sparkle) AIDE'
      this.statusBarItem.tooltip = 'AIDE Suggestions (Enabled)'
    }
  }

  /**
   * Helper to update a state property and emit an event
   */
  private updateState<K extends keyof CompletionState>(
    property: K,
    value: CompletionState[K],
    eventType: CompletionStateEventType
  ): void {
    const privateKey = `_${property}` as keyof this

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (this[privateKey] !== value) {
      this[privateKey] = value as any
      this.emitEvent(eventType, value)
    }
  }

  // Getters and setters with simplified implementation
  get isEnabled(): boolean {
    return this._isEnabled
  }

  set isEnabled(value: boolean) {
    this.updateState('isEnabled', value, CompletionStateEventType.StatusChanged)
  }

  get isSnippetCompletionEnabled(): boolean {
    return this._isSnippetCompletionEnabled && this._isEnabled
  }

  set isSnippetCompletionEnabled(value: boolean) {
    this.updateState(
      'isSnippetCompletionEnabled',
      value,
      CompletionStateEventType.StatusChanged
    )
  }

  get isInlineCompletionEnabled(): boolean {
    return this._isInlineCompletionEnabled && this._isEnabled
  }

  set isInlineCompletionEnabled(value: boolean) {
    this.updateState(
      'isInlineCompletionEnabled',
      value,
      CompletionStateEventType.StatusChanged
    )
  }

  get currentResults(): AutocompleteResult | null {
    return this._currentResults
  }

  set currentResults(value: AutocompleteResult | null) {
    this._currentResults = value
    this.emitEvent(CompletionStateEventType.ResultsChanged, value)
  }

  get isLocked(): boolean {
    return this._isLocked
  }

  set isLocked(value: boolean) {
    this.updateState(
      'isLocked',
      value,
      CompletionStateEventType.LockStateChanged
    )
  }

  get statusMessage(): string {
    return this._statusMessage
  }

  set statusMessage(value: string) {
    this.updateState(
      'statusMessage',
      value,
      CompletionStateEventType.StatusChanged
    )
  }

  get currentTrigger(): SuggestionTrigger {
    return this._currentTrigger
  }

  set currentTrigger(value: SuggestionTrigger) {
    this._currentTrigger = value
  }

  get documentChanges(): DocumentChangesState {
    return this._documentChanges
  }

  /**
   * Emit state change event
   */
  private emitEvent(type: CompletionStateEventType, data?: any): void {
    this.eventEmitter.fire({ type, data })
  }

  /**
   * Update document changes state
   */
  updateDocumentChanges(
    document?: vscode.TextDocument,
    position?: vscode.Position,
    isCompletion: boolean = false
  ): void {
    const now = Date.now()

    this._documentChanges = {
      ...this._documentChanges,
      lastChangeTime: now,
      lastCompletionTime: isCompletion
        ? now
        : this._documentChanges.lastCompletionTime,
      lastDocument: document || this._documentChanges.lastDocument,
      lastPosition: position || this._documentChanges.lastPosition
    }

    if (document) {
      this.emitEvent(CompletionStateEventType.DocumentChanged, document)
    }

    if (position) {
      this.emitEvent(CompletionStateEventType.PositionChanged, position)
    }
  }

  /**
   * Reset state
   */
  reset(): void {
    this._currentResults = null
    this._isLocked = false
    this._statusMessage = ''

    this.emitEvent(CompletionStateEventType.StatusChanged)
  }

  // Debounce configuration methods
  setDebounceConfig(config: Partial<DebounceConfig>): void {
    this.debounceConfig = { ...this.debounceConfig, ...config }
  }

  getDebounceConfig(): DebounceConfig {
    return this.debounceConfig
  }

  /**
   * Check if the last result can be reused for debouncing
   */
  canReuseLastResult(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    if (!this.lastRequest) return false

    const { document: lastDoc, position: lastPos, timestamp } = this.lastRequest

    // Check document, position and time constraints
    return (
      lastDoc.uri.toString() === document.uri.toString() &&
      lastPos.line === position.line &&
      Math.abs(lastPos.character - position.character) <= 1 &&
      Date.now() - timestamp <= this.debounceConfig.maxWait
    )
  }

  /**
   * Save the last request result for debouncing
   */
  saveLastRequest(
    document: vscode.TextDocument,
    position: vscode.Position,
    result: vscode.InlineCompletionList
  ): void {
    this.lastRequest = { document, position, result, timestamp: Date.now() }
  }

  getLastRequestResult(): vscode.InlineCompletionList | undefined {
    return this.lastRequest?.result
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.eventEmitter.dispose()
    this.statusBarItem.dispose()
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []

    this.lastRequest = null
  }
}
