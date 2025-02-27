/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { Fragment } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import type { AIProvider } from '@shared/entities'
import { defineStepper } from '@stepperize/react'
import { Button } from '@webview/components/ui/button'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'

import { ModelForm } from '../model-form'
import { BasicProviderConfigForm } from './basic-provider-config-form'
import {
  createProviderBasicSchema,
  createProviderFormSchema,
  providerModelSchema,
  type ProviderFormValues
} from './provider-utils'

const { useStepper, utils } = defineStepper(
  {
    id: 'provider',
    label: 'webview.aiProvider.providerSettings',
    schema: createProviderBasicSchema
  },
  {
    id: 'model',
    label: 'webview.aiProvider.modelSettings',
    schema: createProviderFormSchema
  }
)

interface CreateProviderFormProps {
  isSubmitting: boolean
  initialProvider?: Partial<AIProvider>
  onSubmit: (data: Partial<AIProvider>) => Promise<void>
}

export const CreateProviderForm = ({
  isSubmitting,
  initialProvider,
  onSubmit
}: CreateProviderFormProps) => {
  const { t } = useTranslation()
  const stepper = useStepper()
  const currentIndex = utils.getIndex(stepper.current.id)
  const form = useForm<ProviderFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(
      stepper.current.schema(t) as unknown as z.ZodType<ProviderFormValues>
    ),
    defaultValues: {
      ...initialProvider,
      order: initialProvider?.order ?? -1,
      extraFields: initialProvider?.extraFields ?? {},
      allowRealTimeModels: initialProvider?.allowRealTimeModels ?? true,
      realTimeModels: initialProvider?.realTimeModels ?? [],
      manualModels: initialProvider?.manualModels ?? []
    }
  })

  const handleSubmit = async (values: ProviderFormValues) => {
    if (stepper.isLast) {
      const providerData: Partial<AIProvider> = {
        ...values,
        id: initialProvider?.id
      }
      await onSubmit(providerData)
    } else {
      // Validate current step before proceeding
      const valid = await form.trigger()
      if (valid) {
        stepper.next()
      }
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col space-y-4 p-4 overflow-hidden"
      >
        <nav
          aria-label={t('webview.aiProvider.providerSetupSteps')}
          className="group px-2"
        >
          <ol className="flex items-center justify-center gap-4">
            {stepper.all.map((step, index) => (
              <Fragment key={step.id}>
                <StepButton
                  step={step}
                  index={index}
                  currentIndex={currentIndex}
                  onClick={async () => {
                    // Validate current step before allowing navigation
                    const valid = await form.trigger()
                    if (!valid) return
                    // Can't skip steps forward but can go back if validated
                    if (index - currentIndex > 1) return
                    stepper.goTo(step.id)
                  }}
                />
                {/* {index < array.length - 1 && (
                <Separator
                  className={index < currentIndex ? 'bg-primary' : 'bg-muted'}
                />
              )} */}
              </Fragment>
            ))}
          </ol>
        </nav>

        <ScrollArea className="flex-1 h-full">
          <div>
            {stepper.switch({
              provider: () => <ProviderStep />,
              model: () => <ModelStep />
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2">
          {!stepper.isFirst && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                // Optionally validate before going back
                const valid = await form.trigger()
                if (valid) {
                  stepper.prev()
                }
              }}
              disabled={stepper.isFirst}
            >
              {t('webview.common.back')}
            </Button>
          )}
          <Button size="sm" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('webview.aiProvider.saving')
              : stepper.isLast
                ? t('webview.aiProvider.complete')
                : t('webview.common.next')}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

const ProviderStep = () => <BasicProviderConfigForm />

const ModelStep = () => {
  const { control, setValue } = useFormContext<ProviderFormValues>()
  const currentValues = useWatch<ProviderFormValues>({ control })

  return (
    <ModelForm
      provider={currentValues as AIProvider}
      setProvider={newValues => {
        const modelFields: (keyof typeof providerModelSchema._type)[] = [
          'allowRealTimeModels',
          'realTimeModels',
          'manualModels'
        ]

        modelFields.forEach(field => {
          if (field in newValues) {
            setValue(field, newValues[field])
          }
        })
      }}
    />
  )
}

// Add StepButton component
interface StepButtonProps {
  step: {
    id: string
    label: string
  }
  index: number
  currentIndex: number
  onClick: () => void
}

const StepButton = ({
  step,
  index,
  currentIndex,
  onClick
}: StepButtonProps) => {
  const { t } = useTranslation()

  return (
    <li
      className="flex items-center gap-2 flex-shrink-0 cursor-pointer"
      onClick={onClick}
    >
      <Button
        type="button"
        role="tab"
        variant={index <= currentIndex ? 'default' : 'secondary'}
        aria-current={step.id === 'current' ? 'step' : undefined}
        size="iconXs"
        className="flex items-center justify-center rounded-full"
      >
        {index + 1}
      </Button>
      <span className="text-sm font-medium">{t(step.label)}</span>
    </li>
  )
}
