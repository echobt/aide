import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ReloadIcon } from '@radix-ui/react-icons'
import type { Project } from '@shared/entities'
import { toUnixPath } from '@shared/utils/common'
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
import { Textarea } from '@webview/components/ui/textarea'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

export type ProjectFormValues = {
  name: string
  path: string
  description?: string
}

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  project: Partial<Project>
  onSave: (values: ProjectFormValues) => void
  editMode?: boolean
}

// Add helper function to detect project name from path
const detectProjectInfo = (path: string) => {
  try {
    // Get the last part of the path as project name
    const pathParts = toUnixPath(path).split(/[/\\]/)
    const projectName = pathParts[pathParts.length - 1]

    return {
      name: projectName
    }
  } catch {
    return null
  }
}

export const ProjectDialog = ({
  open,
  onOpenChange,
  loading,
  project,
  onSave,
  editMode
}: ProjectDialogProps) => {
  const { t } = useTranslation()

  const projectFormSchema = z.object({
    name: z.string().min(1, t('webview.project.validation.nameRequired')),
    path: z.string().min(1, t('webview.project.validation.pathRequired')),
    description: z.string().optional()
  }) satisfies z.ZodType<ProjectFormValues>

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name || '',
      path: project.path || '',
      description: project.description || ''
    }
  })

  // Watch path changes to auto-detect name
  const path = useWatch({
    control: form.control,
    name: 'path'
  })

  useEffect(() => {
    if (!path) return

    // Only auto detect if not in edit mode and name is empty
    if (!editMode) {
      const projectInfo = detectProjectInfo(path)
      if (projectInfo) {
        const currentName = form.getValues('name')

        // Only set name if it's empty
        if (!currentName) {
          form.setValue('name', projectInfo.name || '')
        }
      }
    }
  }, [path, form, editMode])

  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name || '',
        path: project.path || '',
        description: project.description || ''
      })
    }
  }, [open, project, form])

  const handleSubmit = (values: ProjectFormValues) => {
    onSave(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-120 rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode
              ? t('webview.project.editProject')
              : t('webview.project.addProject')}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webview.project.folderPath')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('webview.project.enterFolderPath')}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webview.project.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('webview.project.enterName')}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webview.project.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('webview.project.enterDescription')}
                      className="text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full text-sm">
              {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
              {editMode
                ? t('webview.project.updateProject')
                : t('webview.project.addProject')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
