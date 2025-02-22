import type { FC } from 'react'
import { Label } from '@webview/components/ui/label'
import { cn } from '@webview/utils/common'
import { Controller, useFormContext } from 'react-hook-form'

import { JSONEditor } from './index'

interface FormJsonEditorProps {
  name: string
  label?: string
  description?: string
  schema?: any
  className?: string
  defaultValue?: string
}

export const FormJsonEditor: FC<FormJsonEditorProps> = ({
  name,
  label,
  description,
  schema,
  className,
  defaultValue
}) => {
  const { control } = useFormContext()

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        render={({ field, fieldState: { error } }) => (
          <>
            <JSONEditor
              defaultValue={field.value}
              schemaValue={schema ? JSON.stringify(schema) : undefined}
              onChange={field.onChange}
              className={cn(error && 'border-destructive')}
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error.message}</p>
            )}
          </>
        )}
      />
    </div>
  )
}
