import { useState } from 'react'
import { EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons'
import {
  AIProviderType,
  createAIProviderEntity,
  getAllAIProviderConfigMap
} from '@shared/entities'
import { Button } from '@webview/components/ui/button'
import { Input } from '@webview/components/ui/input'
import { Label } from '@webview/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { cn } from '@webview/utils/common'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'

import { type ProviderBasicFormValues } from './provider-utils'

export const BasicProviderConfigForm = () => {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    {}
  )
  const aiProviderConfigs = getAllAIProviderConfigMap()
  const { register, setValue, control, trigger } =
    useFormContext<ProviderBasicFormValues>()

  const { errors } = useFormState({ control })

  // Watch all form fields
  const formValues = useWatch<ProviderBasicFormValues>({ control })

  const toggleFieldVisibility = (fieldKey: string) => {
    setVisibleFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))
  }

  const handleTypeChange = (type: AIProviderType) => {
    setValue('type', type)
    setValue('extraFields', createAIProviderEntity(type).entity.extraFields)
    trigger('type')
  }

  return (
    <div className="space-y-4">
      {/* Provider Type */}
      <div className="space-y-2">
        <Label className="text-xs block" htmlFor={register('type').name}>
          Provider Type
          <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formValues.type}
          onValueChange={val => handleTypeChange(val as AIProviderType)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select provider type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(aiProviderConfigs).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="block text-xs text-destructive">
            {errors.type.message}
          </p>
        )}
      </div>

      {/* Provider Name */}
      <div className="space-y-2">
        <Label className="text-xs block" htmlFor={register('name').name}>
          Provider Name
          <span className="text-destructive">*</span>
        </Label>
        <Input
          {...register('name')}
          className={cn('text-sm', errors.name && 'border-destructive')}
          placeholder="Enter provider name"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Extra Fields */}
      {formValues.type &&
        aiProviderConfigs[formValues.type]?.fields.map(field => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label
                className="text-xs"
                htmlFor={register(`extraFields.${field.key}`).name}
              >
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                {...register(`extraFields.${field.key}`)}
                className={cn(
                  'text-sm',
                  errors.extraFields?.[field.key] && 'border-destructive'
                )}
                disabled={field.disabled}
                type={
                  field.isSecret && !visibleFields[field.key]
                    ? 'password'
                    : 'text'
                }
              />
              {field.isSecret && (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => toggleFieldVisibility(field.key)}
                >
                  {visibleFields[field.key] ? (
                    <EyeOpenIcon className="h-4 w-4" />
                  ) : (
                    <EyeClosedIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {errors.extraFields?.[field.key] && (
              <p className="block text-xs text-destructive">
                {errors.extraFields[field.key]?.message}
              </p>
            )}
          </div>
        ))}
    </div>
  )
}
