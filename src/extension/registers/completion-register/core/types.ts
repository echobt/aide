import * as vscode from 'vscode'

/**
 * Suggestion trigger types
 */
export enum SuggestionTrigger {
  Manual = 'manual',
  Automatic = 'automatic',
  LookAhead = 'look-ahead'
}

/**
 * Debounce configuration
 */
export interface DebounceConfig {
  delay: number
  maxWait: number
}

/**
 * Last request information for debouncing
 */
export interface LastRequest {
  document: vscode.TextDocument
  position: vscode.Position
  result?: vscode.InlineCompletionList
  timestamp: number
}

/**
 * Completion kind types
 */
export enum CompletionKind {
  Classic = 'classic',
  Line = 'line',
  Snippet = 'snippet'
}

/**
 * Completion result entry
 */
export interface CompletionSuggestion {
  // Text content
  newBeforeCursorText: string
  newAfterCursorText?: string
  guessCompletionText: string

  // Metadata
  completionMetadata?: {
    completionKind?: CompletionKind
    isCached?: boolean
    snippetContext?: string
    score?: number
  }

  // Import information
  imports?: {
    name: string
    path: string
  }[]
}

/**
 * Autocomplete result
 */
export interface AutocompleteResult {
  // Results and metadata
  suggestions: CompletionSuggestion[]
  oldBeforeCursorText: string
  oldAfterCursorText: string
  oldLineTextBeforeCursor: string
  oldLineTextAfterCursor: string
  detailMessage?: string
  isLocked?: boolean
}

/**
 * Autocomplete parameters
 */
export interface AutocompleteParams {
  // Document and position
  document: vscode.TextDocument
  position: vscode.Position

  // Optional parameters
  currentSuggestionText?: string
  retry?: {
    cancellationToken?: vscode.CancellationToken
    interval?: number
    timeout?: number
  }
}

/**
 * Snippet completion item parameters
 */
export interface SnippetCompletionItemParams {
  // Document and position
  document: vscode.TextDocument
  position: vscode.Position

  // Completion data
  entry: CompletionSuggestion
  oldPrefix: string
  results: CompletionSuggestion[]

  // Metadata
  index: number
  detailMessage: string
  limited?: boolean
  suggestionTrigger: SuggestionTrigger
}

/**
 * Document changes tracking state
 */
export interface DocumentChangesState {
  lastChangeTime: number
  lastCompletionTime: number
  lastPosition?: vscode.Position
  lastDocument?: vscode.TextDocument
}
