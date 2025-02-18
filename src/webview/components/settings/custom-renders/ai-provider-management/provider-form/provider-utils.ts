import {
  AIProviderType,
  getAllAIProviderConfigMap,
  type AIProvider
} from '@shared/entities'
import { z } from 'zod'

export const providersQueryKey = 'aiProviders'
export const modelsQueryKey = 'aiModels'

const createExtraFieldsSchema = (type: AIProviderType) => {
  const config = getAllAIProviderConfigMap()[type]
  if (!config) return z.record(z.string())

  const shape: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {}

  config.fields.forEach(field => {
    shape[field.key] = field.required
      ? z.string().min(1, `${field.label} is required`)
      : z.string().optional()
  })

  return z.object(shape)
}

const validateExtraFields = (
  data: { type?: AIProviderType; extraFields?: Record<string, string> },
  ctx: z.RefinementCtx
) => {
  if (data.type) {
    const extraFieldsSchema = createExtraFieldsSchema(data.type)
    const result = extraFieldsSchema.safeParse(data.extraFields)

    if (!result.success) {
      result.error.errors.forEach(err => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message,
          path: ['extraFields', err.path[0]!]
        })
      })
    }
  }
}

const basicObjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Provider name is required'),
  type: z.nativeEnum(AIProviderType, {
    errorMap: () => ({ message: 'Provider type is required' })
  }),
  order: z.number(),
  extraFields: z.record(z.string())
})

export const providerBasicSchema =
  basicObjectSchema.superRefine(validateExtraFields)

export type ProviderBasicFormValues = z.infer<typeof providerBasicSchema>

// Second step schema - model configuration
export const providerModelSchema = z.object({
  allowRealTimeModels: z.boolean(),
  realTimeModels: z.array(z.string()),
  manualModels: z.array(z.string())
}) satisfies z.ZodType<
  Pick<AIProvider, 'allowRealTimeModels' | 'realTimeModels' | 'manualModels'>
>

export type ProviderFormValues = z.infer<typeof providerBasicSchema> &
  z.infer<typeof providerModelSchema>

const formObjectSchema = z.object({
  ...basicObjectSchema.shape,
  ...providerModelSchema.shape
})

export const providerFormSchema = formObjectSchema.superRefine(
  validateExtraFields
) satisfies z.ZodType<ProviderFormValues>
