import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { logger } from '@extension/logger'
import { removeCodeBlockSyntax } from '@extension/utils'
import {
  HumanMessage,
  SystemMessage,
  type AIMessageChunk
} from '@langchain/core/messages'
import { FeatureModelSettingKey } from '@shared/entities'
import * as vscode from 'vscode'

import { CompletionState } from './completion-state'
import { CompletionUtils } from './completion-utils'
import { completionConfig } from './constants'
import {
  AutocompleteParams,
  AutocompleteResult,
  CompletionKind,
  CompletionSuggestion,
  SuggestionTrigger
} from './types'

/**
 * Core service for completion functionality
 */
export class CompletionService {
  private disposables: vscode.Disposable[] = []

  private debounceTimer: NodeJS.Timeout | null = null

  private debounceDelay = 300 // Default debounce delay in milliseconds

  constructor(private readonly completionState: CompletionState) {}

  /**
   * Get completion suggestions for a specific trigger
   */
  async getCompletionResult(
    document: vscode.TextDocument,
    position: vscode.Position,
    trigger: SuggestionTrigger = SuggestionTrigger.Automatic
  ): Promise<AutocompleteResult | null> {
    // Set current trigger and check timing
    this.completionState.currentTrigger = trigger

    if (!this.shouldProvideCompletion()) {
      return null
    }

    // Use debounce for automatic triggers, immediate execution for explicit ones
    return trigger === SuggestionTrigger.Automatic
      ? this.debounceCompletionRequest(document, position)
      : this.executeCompletionRequest(document, position)
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(
    params: AutocompleteParams
  ): Promise<AutocompleteResult | null> {
    const { document, position } = params

    // Early return if completion is not allowed
    if (
      !this.completionState.isEnabled ||
      !CompletionUtils.isCompletionAllowed(document, position)
    ) {
      return null
    }

    try {
      return await this.fetchCompletionWithTimeout(params)
    } catch (error) {
      logger.error('Error getting autocomplete suggestions', error)
      return null
    }
  }

  /**
   * Request to toggle completions
   */
  requestToggle(): void {
    this.completionState.isEnabled = !this.completionState.isEnabled
  }

  /**
   * Set debounce delay
   */
  setDebounceDelay(delay: number): void {
    if (delay >= 0) {
      this.debounceDelay = delay
    }
  }

  // PRIVATE METHODS

  /**
   * Debounce the completion request
   */
  private debounceCompletionRequest(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<AutocompleteResult | null> {
    return new Promise(resolve => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(async () => {
        resolve(await this.executeCompletionRequest(document, position))
      }, this.debounceDelay)
    })
  }

  /**
   * Execute the actual completion request
   */
  private async executeCompletionRequest(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<AutocompleteResult | null> {
    const result = await this.autocomplete({ document, position })

    if (!result?.suggestions?.length) {
      return null
    }

    return {
      ...result,
      suggestions: CompletionUtils.formatCompletionResults(result.suggestions)
    }
  }

  /**
   * Fetch completion with timeout
   */
  private async fetchCompletionWithTimeout(
    params: AutocompleteParams
  ): Promise<AutocompleteResult | null> {
    const { document, position, retry } = params
    const timeout = retry?.timeout || completionConfig.inlineRequestTimeout
    const cancellationToken =
      retry?.cancellationToken || new vscode.CancellationTokenSource().token

    // Race between API request and timeout
    const result = await Promise.race([
      this.fetchCompletions(params, { cancellationToken }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeout))
    ])

    if (!result) {
      logger.log('Completion request timed out')
      return null
    }

    // Update state with results
    this.completionState.currentResults = result
    this.completionState.updateDocumentChanges(document, position, true)

    return result
  }

  /**
   * Fetch completions from AI model
   */
  private async fetchCompletions(
    params: AutocompleteParams,
    options: { cancellationToken?: vscode.CancellationToken }
  ): Promise<AutocompleteResult> {
    try {
      const { document, position } = params
      const { cancellationToken } = options

      // Get context for completion
      const context = CompletionUtils.getCompletionContext(document, position)
      const {
        beforeCursorText,
        afterCursorText,
        lineTextBeforeCursor,
        lineTextAfterCursor
      } = context

      // Add language and file path information
      const language = document.languageId || 'typescript'
      const filePath = document.uri.fsPath || ''

      // Check if operation was cancelled
      if (cancellationToken?.isCancellationRequested) {
        throw new Error('Operation cancelled')
      }

      // Setup AI model
      const modelProvider = await ModelProviderFactory.getModelProvider(
        FeatureModelSettingKey.Completion
      )
      const aiModelAbortController = new AbortController()
      cancellationToken?.onCancellationRequested(() => {
        aiModelAbortController.abort()
      })

      // Build prompt and get response
      const systemPrompt = this.buildCompletionSystemPrompt(
        beforeCursorText,
        afterCursorText,
        lineTextBeforeCursor,
        lineTextAfterCursor,
        language,
        filePath
      )

      const aiModel = (await modelProvider.createLangChainModel()).bind({
        signal: aiModelAbortController.signal,
        maxTokens: 256,
        temperature: 0.2
      })

      const response = await aiModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(
          `Analyze my intent based on the code context and generate the most appropriate code continuation at the cursor position. Focus on producing syntactically valid and contextually relevant code that follows the existing patterns and style. Provide only the code that should be inserted, with no explanations or formatting.`
        )
      ])

      // Process and return the results
      return this.processCompletionResponse(
        response,
        beforeCursorText,
        afterCursorText,
        lineTextBeforeCursor,
        lineTextAfterCursor
      )
    } catch (error) {
      logger.error('Error fetching completions from AI model', error)
      throw error
    }
  }

  /**
   * Build a prompt for code completion
   */
  private buildCompletionSystemPrompt(
    beforeCursorText: string,
    afterCursorText: string,
    lineTextBeforeCursor: string,
    lineTextAfterCursor: string,
    language: string,
    filePath: string
  ): string {
    // Determine language from file extension if not provided
    const fileExtension = filePath ? filePath.split('.').pop() || '' : ''
    const detectedLanguage =
      language ||
      (fileExtension
        ? CompletionUtils.getLanguageFromExtension(fileExtension)
        : 'typescript')

    return `<task>
You are an AI code completion assistant. Your task is to predict and generate the most likely code continuation at the cursor position (marked as <CURSOR> in examples).
First understand the user's intent based on surrounding code, then generate the most appropriate completion.
</task>

<context>
You are looking at a file: ${filePath || 'Unknown'}
Language: ${detectedLanguage}
Current line before cursor: "${lineTextBeforeCursor}"
Current line after cursor: "${lineTextAfterCursor}"
</context>

<constraints>
1. ONLY generate code that would naturally continue from the cursor position
2. DO NOT repeat any code that appears before the cursor
3. DO NOT modify or reference the code that appears after the cursor - that code already exists and should not be changed
4. DO NOT include markdown formatting, explanations, or comments about your completion
5. Provide ONLY the code completion itself
6. Follow the existing code style, indentation, and naming conventions
7. Be concise but complete - generate a meaningful unit of code
8. Your completion should be syntactically valid and follow best practices for ${detectedLanguage}
9. Analyze patterns in the existing code to match variable naming, formatting, and coding style
</constraints>

<intent_analysis>
Before generating code, analyze:
1. What is the user likely trying to accomplish?
2. What patterns exist in the surrounding code?
3. What would be the most logical continuation based on context?
4. Are there any common patterns or idioms that should be applied?
</intent_analysis>

<examples>
Example 1:
Code with cursor position:
\`\`\`typescript
function calculateTotal(items: Item[]): number {<CURSOR>
}
\`\`\`

Intent analysis: User is defining a function to calculate a total from an array of items. They likely need to handle empty arrays and sum up values.

Correct completion:
\`\`\`
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
\`\`\`

Example 2:
Code with cursor position:
\`\`\`typescript
class UserService {
  private users: User[] = [];

  constructor(private readonly dbClient: DatabaseClient) {<CURSOR>
}
\`\`\`

Intent analysis: User is defining a UserService class with a constructor. They likely need to add methods to interact with users via the dbClient.

Correct completion:
\`\`\`
  }

  async getUser(id: string): Promise<User | null> {
    try {
      return await this.dbClient.findUserById(id);
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }
\`\`\`

Example 3:
Code with cursor position:
\`\`\`typescript
interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;<CURSOR>
\`\`\`

Intent analysis: User is defining an interface for completion options. They likely need to add more optional configuration properties.

Correct completion:
\`\`\`
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryCount?: number;
}
\`\`\`

Example 4:
Code with cursor position:
\`\`\`typescript
const fetchData = async () => {
  try {
    const response = await api.get('/users');<CURSOR>
    setUsers(response.data);
  } catch (error) {
    console.error('Failed to fetch users', error);
  }
};
\`\`\`

Intent analysis: User is writing an async function to fetch data. They likely need to process the response before setting state.

Correct completion:
\`\`\`

    if (!response || !response.data) {
      throw new Error('Invalid response');
    }

\`\`\`

Example 5:
Code with cursor position:
\`\`\`typescript
useEffect(() => {<CURSOR>
}, [userId]);
\`\`\`

Intent analysis: User is setting up a React useEffect hook that depends on userId. They likely need to fetch or process data related to that userId.

Correct completion:
\`\`\`
  if (!userId) return;

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const data = await userService.getUserById(userId);
      setUserData(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  fetchUserData();
\`\`\`
</examples>

<input>
Code with cursor position:
\`\`\`${detectedLanguage}
${beforeCursorText}<CURSOR>${afterCursorText}
\`\`\`

Intent analysis: Based on the code context, the user likely needs a completion that:
1. Follows the existing code patterns and style
2. Provides a logical continuation at this specific point
3. Maintains syntactic correctness and semantic meaning
</input>

<output_format>
Provide ONLY the code that should be inserted at the cursor position.
Do not include any explanations, markdown formatting, or code block syntax.
</output_format>`
  }

  /**
   * Process the AI model response into the expected format
   */
  private processCompletionResponse(
    response: AIMessageChunk,
    beforeCursorText: string,
    afterCursorText: string,
    lineTextBeforeCursor: string,
    lineTextAfterCursor: string
  ): AutocompleteResult {
    try {
      // Extract and clean up the completion
      const content = response.content || ''
      const contentText =
        typeof content === 'string' ? content : (content[0] as any)?.text || ''
      const cleanedContent = removeCodeBlockSyntax(contentText)

      // Create completion suggestion
      const suggestion: CompletionSuggestion = {
        newBeforeCursorText: beforeCursorText + cleanedContent,
        newAfterCursorText: afterCursorText,
        guessCompletionText: cleanedContent,
        completionMetadata: {
          completionKind: CompletionKind.Classic,
          isCached: false,
          score: 0.1,
          snippetContext: 'AI suggestion'
        }
      }

      // Return formatted result
      return {
        suggestions: [suggestion],
        oldBeforeCursorText: beforeCursorText,
        oldAfterCursorText: afterCursorText,
        oldLineTextBeforeCursor: lineTextBeforeCursor,
        oldLineTextAfterCursor: lineTextAfterCursor,
        detailMessage: 'AI Suggestion'
      }
    } catch (error) {
      logger.error('Error processing AI model completion response', error)

      // Return a fallback result
      return {
        suggestions: [],
        oldBeforeCursorText: beforeCursorText,
        oldAfterCursorText: afterCursorText,
        oldLineTextBeforeCursor: lineTextBeforeCursor,
        oldLineTextAfterCursor: lineTextAfterCursor,
        detailMessage: 'Error processing completion'
      }
    }
  }

  /**
   * Check if completion should be provided based on timing
   */
  private shouldProvideCompletion(): boolean {
    const { lastCompletionTime } = this.completionState.documentChanges
    return CompletionUtils.hasEnoughTimePassed(lastCompletionTime)
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
