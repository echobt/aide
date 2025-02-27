import { useState } from 'react'
import {
  CaretSortIcon,
  EyeClosedIcon,
  EyeOpenIcon
} from '@radix-ui/react-icons'
import type { SettingConfigItem } from '@shared/entities'
import { Input } from '@webview/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { Switch } from '@webview/components/ui/switch'
import { Textarea } from '@webview/components/ui/textarea'
import { cn } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

import { ButtonWithTooltip } from '../button-with-tooltip'
import { ModelSelector } from '../chat/selectors/model-selector'
import { JSONEditor } from '../json-editor'
import { About } from './custom-renders/about'
import { AIProviderManagement } from './custom-renders/ai-provider-management'
import { CodebaseIndexing } from './custom-renders/codebase'
import { DocManagement } from './custom-renders/doc-management'
import { GitProjectManagement } from './custom-renders/git-project-management'
import { LanguageSelector } from './custom-renders/language-selector'
import { McpManagement } from './custom-renders/mcp-management'
import { ProjectManagement } from './custom-renders/project-management'
import { PromptSnippetManagement } from './custom-renders/prompt-snippet-management'
import { ThemeSelector } from './custom-renders/theme-selector'

interface SettingItemRendererProps {
  value: any
  onChange: (value: any) => void
  onSubmit: (value: any) => void
  disabled?: boolean
  config: SettingConfigItem
}

export const SettingItemRenderer = ({
  value,
  onChange,
  onSubmit,
  disabled,
  config
}: SettingItemRendererProps) => {
  const { t } = useTranslation()
  const [showSecret, setShowSecret] = useState(false)

  const val = value ?? config.renderOptions.defaultValue
  const inputProps = {
    disabled,
    value: val,
    onChange: (e: any) => onChange(e.target.value),
    onBlur: (e: any) => onSubmit(e.target.value),
    placeholder: config.renderOptions.placeholder ?? '',
    className: cn(
      'text-sm transition-colors duration-200',
      disabled && 'opacity-60',
      config.renderOptions.className
    )
  }

  switch (config.renderOptions.type) {
    case 'input':
      return (
        <div className="flex gap-2">
          <Input
            type={showSecret ? 'text' : 'password'}
            {...inputProps}
            className={cn(inputProps.className, 'font-mono tracking-wide')}
          />
          <ButtonWithTooltip
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            tooltip={
              showSecret
                ? t('webview.settings.hideSecret')
                : t('webview.settings.showSecret')
            }
            className="hover:bg-muted/80"
          >
            {showSecret ? (
              <EyeOpenIcon className="h-4 w-4" />
            ) : (
              <EyeClosedIcon className="h-4 w-4" />
            )}
          </ButtonWithTooltip>
        </div>
      )

    case 'textarea':
      return (
        <Textarea
          {...inputProps}
          rows={Math.min(Math.max(4, val?.split('\n').length || 4), 15)}
          className={cn(
            inputProps.className,
            'resize-none min-h-[100px] font-mono'
          )}
        />
      )

    case 'switch':
      return (
        <Switch
          checked={val}
          onCheckedChange={checked => {
            onChange(checked)
            onSubmit(checked)
          }}
          disabled={disabled}
          className={cn(
            'data-[state=unchecked]:bg-foreground/50',
            config.renderOptions.className
          )}
        />
      )

    case 'numberInput':
      return (
        <Input
          type="number"
          {...inputProps}
          onChange={e => onChange(Number(e.target.value))}
          onBlur={e => onSubmit(Number(e.target.value))}
          className={cn(inputProps.className, 'font-mono')}
        />
      )

    case 'selectInput':
      return (
        <Select
          value={val}
          onValueChange={value => {
            onChange(value)
            onSubmit(value)
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn('h-9 w-full text-sm', disabled && 'opacity-60')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.renderOptions.options?.map(option => {
              const { label, value } =
                typeof option === 'string'
                  ? { label: option, value: option }
                  : option
              return (
                <SelectItem key={value} value={value} className="text-sm">
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )

    case 'jsonEditor':
      return (
        <JSONEditor
          initValue={val ?? config.renderOptions.defaultValue}
          defaultValue={config.renderOptions.defaultValue}
          schemaValue={config.renderOptions.schemaValue}
          onChange={value => onChange(value)}
          onBlur={(value, isValid) => (isValid || !value) && onSubmit(value)}
          placeholder={config.renderOptions.placeholder}
          className={cn('h-100', config.renderOptions.className)}
        />
      )

    case 'themeSelector':
      return <ThemeSelector />

    case 'languageSelector':
      return <LanguageSelector />

    case 'modelSelector':
      return (
        <ModelSelector
          featureModelSettingKey={config.renderOptions.featureModelSettingKey}
          renderTrigger={({ tooltip, title }) => (
            <ButtonWithTooltip
              tooltip={tooltip}
              variant="outline"
              size="xs"
              className={cn(
                'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:border focus:border-ring [&>span]:line-clamp-1',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              {title}
              <CaretSortIcon className="h-4 w-4 opacity-50" />
            </ButtonWithTooltip>
          )}
        />
      )

    case 'codebaseIndexing':
      return <CodebaseIndexing />

    case 'docManagement':
      return <DocManagement />

    case 'promptSnippetManagement':
      return <PromptSnippetManagement />

    case 'modelManagement':
      return <AIProviderManagement />

    case 'projectManagement':
      return <ProjectManagement />

    case 'gitProjectManagement':
      return <GitProjectManagement />

    case 'mcpManagement':
      return <McpManagement />

    case 'about':
      return <About />

    default:
      return null
  }
}
