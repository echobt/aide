import { useState } from 'react'
import type { GitProject } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

import { GitProjectCard } from './git-project-card'
import {
  GitProjectDialog,
  type GitProjectFormValues
} from './git-project-dialog'

export const GitProjectManagement = () => {
  const { invalidateQueries } = useInvalidateQueries()
  const [project, setProject] = useState<Partial<GitProject>>({
    name: '',
    type: 'github',
    repoUrl: '',
    description: ''
  })
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())

  // Queries
  const { data: projects = [] } = useQuery({
    queryKey: ['git-projects', searchQuery],
    queryFn: ({ signal }) =>
      searchQuery
        ? api.actions().server.gitProject.searchGitProjects({
            actionParams: { query: searchQuery },
            abortController: signalToController(signal)
          })
        : api.actions().server.gitProject.getGitProjects({
            actionParams: {},
            abortController: signalToController(signal)
          })
  })

  // Mutations
  const addProjectMutation = useMutation({
    mutationFn: (data: GitProjectFormValues) =>
      api.actions().server.gitProject.addGitProject({
        actionParams: data as GitProject
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['git-projects']
      })
      toast.success('New git project added successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to add git project', error)
    }
  })

  const updateProjectMutation = useMutation({
    mutationFn: (data: GitProjectFormValues & { id: string }) =>
      api.actions().server.gitProject.updateGitProject({
        actionParams: data as GitProject
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['git-projects']
      })
      toast.success('Git project updated successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to update git project', error)
    }
  })

  const removeProjectsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.gitProject.removeGitProjects({
        actionParams: { ids }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['git-projects']
      })
      toast.success('Git project removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove git project', error)
    }
  })

  const refreshProjectMutation = useMutation({
    mutationFn: (id: string) =>
      api.actions().server.gitProject.refreshGitProject({
        actionParams: { id }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['git-projects']
      })
      toast.success('Git project refreshed successfully')
    },
    onError: error => {
      logAndToastError('Failed to refresh git project', error)
    },
    onSettled: (_, __, id) => {
      setRefreshingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  })

  const handleSaveProject = async (values: GitProjectFormValues) => {
    if (editingProjectId) {
      updateProjectMutation.mutate({
        id: editingProjectId,
        ...values
      })
    } else {
      addProjectMutation.mutate(values)
    }
  }

  const handleEditProject = (projectToEdit: GitProject) => {
    setEditingProjectId(projectToEdit.id)
    setProject(projectToEdit)
    setIsDialogOpen(true)
  }

  const handleOpenDialog = () => {
    clearProjectFields()
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    clearProjectFields()
  }

  const handleRemoveProjects = (items: GitProject[]) => {
    removeProjectsMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearProjectFields = () => {
    setProject({
      name: '',
      type: 'github',
      repoUrl: '',
      description: ''
    })
    setEditingProjectId(null)
  }

  const handleRefreshProject = async (id: string) => {
    setRefreshingIds(prev => new Set(prev).add(id))
    refreshProjectMutation.mutate(id)
  }

  return (
    <div className="space-y-4">
      <CardList
        items={projects}
        idField="id"
        draggable={false}
        minCardWidth={300}
        onCreateItem={handleOpenDialog}
        onDeleteItems={handleRemoveProjects}
        headerLeftActions={
          <Input
            placeholder="Search git projects..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: project, isSelected, onSelect }) => (
          <GitProjectCard
            project={project}
            onEdit={handleEditProject}
            onRemove={() => handleRemoveProjects([project])}
            onRefresh={handleRefreshProject}
            isSelected={isSelected}
            onSelect={onSelect}
            refreshing={refreshingIds.has(project.id)}
          />
        )}
      />

      <GitProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        loading={
          addProjectMutation.isPending || updateProjectMutation.isPending
        }
        project={project}
        onSave={handleSaveProject}
        editMode={Boolean(editingProjectId)}
      />
    </div>
  )
}
