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
import * as z from 'zod'

const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  path: z.string().min(1, 'Project path is required'),
  description: z.string().optional()
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>

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
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit Project' : 'Add New Project'}
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
                  <FormLabel>Folder Path</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project folder path"
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project name"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter project description"
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
              {editMode ? 'Update Project' : 'Add Project'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
