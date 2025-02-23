import type { FeatureModelSettingKey } from '../ai-provider-entity'

export type SettingsSaveType = 'global' | 'workspace'

interface BaseRenderOptions<FormType, ValueType> {
  type: FormType
  label: string
  description: string
  placeholder?: string
  className?: string
  defaultValue: ValueType
}

export type InputRenderOptions = BaseRenderOptions<'input', string>
export type TextareaRenderOptions = BaseRenderOptions<'textarea', string>
export type SwitchRenderOptions = BaseRenderOptions<'switch', boolean>
export type NumberInputRenderOptions = BaseRenderOptions<'numberInput', number>
export type SelectInputRenderOptions = BaseRenderOptions<
  'selectInput',
  string
> & {
  options: Array<string | { label: string; value: string }>
}
export type JSONEditorRenderOptions = BaseRenderOptions<
  'jsonEditor',
  string
> & {
  schemaValue?: string
}

export type ModelManagementRenderOptions = BaseRenderOptions<
  'modelManagement',
  any
>
export type ModelSelectorRenderOptions = BaseRenderOptions<
  'modelSelector',
  any
> & {
  featureModelSettingKey: FeatureModelSettingKey
}

export type DocIndexingRenderOptions = BaseRenderOptions<'docManagement', any>
export type PromptSnippetManagementRenderOptions = BaseRenderOptions<
  'promptSnippetManagement',
  any
>
export type ProjectManagementRenderOptions = BaseRenderOptions<
  'projectManagement',
  any
>
export type CodebaseIndexingRenderOptions = BaseRenderOptions<
  'codebaseIndexing',
  any
>
export type GitProjectManagementRenderOptions = BaseRenderOptions<
  'gitProjectManagement',
  any
>
export type McpManagementRenderOptions = BaseRenderOptions<'mcpManagement', any>
export type AboutRenderOptions = BaseRenderOptions<'about', any>

export type RenderOptions =
  | InputRenderOptions
  | TextareaRenderOptions
  | SwitchRenderOptions
  | NumberInputRenderOptions
  | SelectInputRenderOptions
  | JSONEditorRenderOptions
  | ModelManagementRenderOptions
  | ModelSelectorRenderOptions
  | DocIndexingRenderOptions
  | CodebaseIndexingRenderOptions
  | PromptSnippetManagementRenderOptions
  | ProjectManagementRenderOptions
  | GitProjectManagementRenderOptions
  | McpManagementRenderOptions
  | AboutRenderOptions

export type RenderOptionsType = RenderOptions['type']
export type RenderOptionsMap = {
  [T in RenderOptionsType]: Extract<RenderOptions, { type: T }>
}
