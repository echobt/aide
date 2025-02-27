import {
  AIProviderType,
  getAllAIProviderConfigMap,
  type AIProvider
} from '@shared/entities'
import { type TFunction } from 'i18next'
import { z } from 'zod'

export const providersQueryKey = 'aiProviders'
export const modelsQueryKey = 'aiModels'

const createExtraFieldsSchema = (t: TFunction, type: AIProviderType) => {
  const config = getAllAIProviderConfigMap()[type]
  if (!config) return z.record(z.string())

  const shape: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {}

  config.fields.forEach(field => {
    shape[field.key] = field.required
      ? z
          .string()
          .min(
            1,
            `${field.label} ${t('webview.aiProvider.validation.isRequired')}`
          )
      : z.string().optional()
  })

  return z.object(shape)
}

const createValidateExtraFields =
  (t: TFunction) =>
  (
    data: { type?: AIProviderType; extraFields?: Record<string, string> },
    ctx: z.RefinementCtx
  ) => {
    if (data.type) {
      const extraFieldsSchema = createExtraFieldsSchema(t, data.type)
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

const createBasicObjectSchema = (t: TFunction) =>
  z.object({
    id: z.string().optional(),
    name: z
      .string()
      .min(1, t('webview.aiProvider.validation.providerNameRequired')),
    type: z.nativeEnum(AIProviderType, {
      errorMap: () => ({
        message: t('webview.aiProvider.validation.providerTypeRequired')
      })
    }),
    order: z.number(),
    extraFields: z.record(z.string())
  })

export const createProviderBasicSchema = (t: TFunction) =>
  createBasicObjectSchema(t).superRefine(createValidateExtraFields(t))

export type ProviderBasicFormValues = z.infer<
  ReturnType<typeof createProviderBasicSchema>
>

// Second step schema - model configuration
export const providerModelSchema = z.object({
  allowRealTimeModels: z.boolean(),
  realTimeModels: z.array(z.string()),
  manualModels: z.array(z.string())
}) satisfies z.ZodType<
  Pick<AIProvider, 'allowRealTimeModels' | 'realTimeModels' | 'manualModels'>
>

export type ProviderFormValues = z.infer<
  ReturnType<typeof createProviderBasicSchema>
> &
  z.infer<typeof providerModelSchema>

const createFormObjectSchema = (t: TFunction) =>
  z.object({
    ...createBasicObjectSchema(t).shape,
    ...providerModelSchema.shape
  })

export const createProviderFormSchema = (t: TFunction) =>
  createFormObjectSchema(t).superRefine(createValidateExtraFields(t))
