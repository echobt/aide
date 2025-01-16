import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ReloadIcon } from '@radix-ui/react-icons'
import type { GitProject, GitProjectType } from '@shared/entities'
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
import { Textarea } from '@webview/components/ui/textarea'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

const gitProjectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  type: z.enum(['github', 'gitlab', 'bitbucket']),
  repoUrl: z.string().min(1, 'Repository URL is required').url('Invalid URL'),
  description: z.string().optional()
})

export type GitProjectFormValues = z.infer<typeof gitProjectFormSchema>

interface GitProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  project: Partial<GitProject>
  onSave: (values: GitProjectFormValues) => void
  editMode?: boolean
}

const detectGitType = (url: string): GitProjectType | null => {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname.includes('github.com')) return 'github'
    if (hostname.includes('gitlab.com')) return 'gitlab'
    if (hostname.includes('bitbucket.org')) return 'bitbucket'

    return null
  } catch {
    return null
  }
}

const detectGitInfo = (url: string) => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.replace(/\.git$/, '')
    const pathParts = pathname.split('/')
    // Get repo name from path
    const repoName = pathParts[pathParts.length - 1]
    // Get owner/org name
    const ownerName = pathParts[pathParts.length - 2]

    return {
      name: repoName,
      description: `${ownerName}/${repoName}`
    }
  } catch {
    return null
  }
}

export const GitProjectDialog = ({
  open,
  onOpenChange,
  loading,
  project,
  onSave,
  editMode
}: GitProjectDialogProps) => {
  const form = useForm<GitProjectFormValues>({
    resolver: zodResolver(gitProjectFormSchema),
    defaultValues: {
      name: project.name || '',
      type: project.type || 'github',
      repoUrl: project.repoUrl || '',
      description: project.description || ''
    }
  })

  // Watch repoUrl changes to auto-detect type and info
  const repoUrl = useWatch({
    control: form.control,
    name: 'repoUrl'
  })

  useEffect(() => {
    if (!repoUrl) return

    // Auto detect type
    const detectedType = detectGitType(repoUrl)
    if (detectedType) {
      form.setValue('type', detectedType)
    }

    // Auto detect name and description if not in edit mode and fields are empty
    if (!editMode) {
      const gitInfo = detectGitInfo(repoUrl)
      if (gitInfo) {
        const currentName = form.getValues('name')
        const currentDesc = form.getValues('description')

        // Only set if fields are empty
        if (!currentName) {
          form.setValue('name', gitInfo?.name || '')
        }
        if (!currentDesc) {
          form.setValue('description', gitInfo?.description || '')
        }
      }
    }
  }, [repoUrl, form, editMode])

  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name || '',
        type: project.type || 'github',
        repoUrl: project.repoUrl || '',
        description: project.description || ''
      })
    }
  }, [open, project, form])

  const onSubmit = (values: GitProjectFormValues) => {
    onSave(values)
  }

  // Detect if type should be disabled based on URL
  const detectedType = repoUrl ? detectGitType(repoUrl) : null
  const typeDisabled = Boolean(detectedType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit Git Project' : 'Add Git Project'}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? 'Edit your git project details below'
              : 'Add a new git project by entering the details below'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="repoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter repository URL"
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={typeDisabled}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select repository type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    </SelectContent>
                  </Select>
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
              {editMode ? 'Update Git Project' : 'Add Git Project'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
