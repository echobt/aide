export enum PluginId {
  Fs = 'fsPlugin',
  Web = 'webPlugin',
  Doc = 'docPlugin',
  Git = 'gitPlugin',
  Terminal = 'terminalPlugin',
  PromptSnippet = 'promptSnippetPlugin'
}

export type PluginState = Record<string, any>

export type ValidRecipeReturnType<State> =
  | State
  | void
  | undefined
  | (State extends undefined ? any : never)
