import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ReloadIcon } from '@radix-ui/react-icons'
import type { McpConfig } from '@shared/entities'
import { mcpConfigSchema, McpEntity } from '@shared/entities'
import { Button } from '@webview/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@webview/components/ui/form'
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
import { logAndToastError } from '@webview/utils/common'
import { useForm, useWatch } from 'react-hook-form'
import { parse } from 'shell-quote'
import * as z from 'zod'

const mcpFormSchema = mcpConfigSchema.extend({
  isEnabled: z.boolean()
})

export type McpFormValues = z.infer<typeof mcpFormSchema>

interface McpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  config: Partial<McpConfig>
  onSave: (values: McpFormValues) => void
  editMode?: boolean
}

export const McpDialog = ({
  open,
  onOpenChange,
  loading,
  config,
  onSave,
  editMode
}: McpDialogProps) => {
  const defaultValues = useMemo(() => {
    if (config) {
      const values = { ...config }
      // Combine command and args into a single string if type is stdio
      if (config.transportConfig?.type === 'stdio') {
        const { command, args = [] } = config.transportConfig
        values.transportConfig = {
          ...config.transportConfig,
          command: [command, ...args].join(' ')
        }
      }
      return values
    }

    return new McpEntity().entity
  }, [config])

  const form = useForm<McpFormValues>({
    resolver: zodResolver(mcpFormSchema),
    defaultValues
  })

  useEffect(() => {
    if (open) {
      form.reset(defaultValues)
    }
  }, [open, form.reset, defaultValues])

  const transportType = useWatch({
    control: form.control,
    name: 'transportConfig.type'
  })

  const renderTransportFields = () => {
    switch (transportType) {
      case 'stdio':
        return (
          <>
            <FormField
              control={form.control}
              name="transportConfig.command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Command</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter command"
                      className="text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )

      case 'websocket':
      case 'sse':
        return (
          <FormField
            control={form.control}
            name="transportConfig.url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter URL"
                    className="text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      default:
        return null
    }
  }

  const onSubmit = async (values: z.infer<typeof mcpFormSchema>) => {
    try {
      // Parse command string into command and args if type is stdio
      if (values.transportConfig.type === 'stdio') {
        const parsed = parse(values.transportConfig.command)
        values.transportConfig = {
          ...values.transportConfig,
          command: String(parsed[0] || ''),
          args: parsed.slice(1).map(arg => String(arg))
        }
      }
      onSave(values)
    } catch (error) {
      logAndToastError('Failed to save MCP configuration', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-120 rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit MCP Configuration' : 'Add MCP Configuration'}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter configuration name"
                      className="text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transportConfig.type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transport Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select transport type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stdio">command</SelectItem>
                      <SelectItem value="sse">sse</SelectItem>
                      <SelectItem value="websocket">ws</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {renderTransportFields()}

            {/* <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description"
                      className="text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            <FormField
              control={form.control}
              name="isEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Enable Now</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full text-sm">
              {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
              {editMode ? 'Update Configuration' : 'Add Configuration'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
