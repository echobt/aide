import { zodResolver } from '@hookform/resolvers/zod'
import { AIProvider } from '@shared/entities'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@webview/components/ui/accordion'
import { Badge } from '@webview/components/ui/badge'
import { Button } from '@webview/components/ui/button'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { FormProvider, useForm, useWatch } from 'react-hook-form'

import { ModelForm } from '../model-form'
import { BasicProviderConfigForm } from './basic-provider-config-form'
import {
  providerFormSchema,
  type ProviderFormValues,
  type providerModelSchema
} from './provider-utils'

interface EditProviderFormProps {
  initialProvider: Partial<AIProvider>
  isSubmitting: boolean
  onSubmit: (data: Partial<AIProvider>) => Promise<void>
}

export const EditProviderForm = ({
  initialProvider,
  isSubmitting,
  onSubmit
}: EditProviderFormProps) => {
  const form = useForm<ProviderFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      ...initialProvider,
      order: initialProvider?.order ?? -1,
      extraFields: initialProvider?.extraFields ?? {},
      allowRealTimeModels: initialProvider?.allowRealTimeModels ?? true,
      realTimeModels: initialProvider?.realTimeModels ?? [],
      manualModels: initialProvider?.manualModels ?? []
    }
  })
  const formValues = useWatch<ProviderFormValues>({ control: form.control })

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-col flex-1 overflow-hidden"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-col p-4 space-y-4 overflow-hidden">
          <Accordion type="single" collapsible>
            <AccordionItem value="provider-config" className="border-none">
              <AccordionTrigger className="hover:no-underline p-0 h-9">
                <div className="flex items-center gap-2">
                  <span>Provider Configuration</span>
                  <Badge variant="outline">{formValues.type}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <BasicProviderConfigForm />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <ScrollArea className="flex-1">
            <ModelForm
              provider={formValues as AIProvider}
              setProvider={newValues => {
                const modelFields: (keyof typeof providerModelSchema._type)[] =
                  ['allowRealTimeModels', 'realTimeModels', 'manualModels']

                modelFields.forEach(field => {
                  if (field in newValues) {
                    form.setValue(field, newValues[field])
                  }
                })
              }}
            />
          </ScrollArea>

          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
