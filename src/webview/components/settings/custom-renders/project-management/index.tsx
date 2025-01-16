import { useState } from 'react'
import type { Project } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

import { ProjectCard } from './project-card'
import { ProjectDialog, type ProjectFormValues } from './project-dialog'

export const ProjectManagement = () => {
  const queryClient = useQueryClient()
  const [project, setProject] = useState<Partial<Project>>({
    name: '',
    path: '',
    description: ''
  })
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Queries
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', searchQuery],
    queryFn: ({ signal }) =>
      searchQuery
        ? api.actions().server.project.searchProjects({
            actionParams: { query: searchQuery },
            abortController: signalToController(signal)
          })
        : api.actions().server.project.getProjects({
            actionParams: {},
            abortController: signalToController(signal)
          })
  })

  // Mutations
  const addProjectMutation = useMutation({
    mutationFn: (data: { name: string; path: string; description: string }) =>
      api.actions().server.project.addProject({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('New project added successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to add project', error)
    }
  })

  const updateProjectMutation = useMutation({
    mutationFn: (data: {
      id: string
      name: string
      path: string
      description: string
    }) =>
      api.actions().server.project.updateProject({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to update project', error)
    }
  })

  const removeProjectsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.project.removeProjects({
        actionParams: { ids }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove project', error)
    }
  })

  const handleSaveProject = async (values: ProjectFormValues) => {
    if (editingProjectId) {
      updateProjectMutation.mutate({
        id: editingProjectId,
        ...values
      } as Project)
    } else {
      addProjectMutation.mutate(values as Project)
    }
  }

  const handleEditProject = (projectToEdit: Project) => {
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

  const handleRemoveProjects = (items: Project[]) => {
    removeProjectsMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearProjectFields = () => {
    setProject({
      name: '',
      path: '',
      description: ''
    })
    setEditingProjectId(null)
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
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: project, isSelected, onSelect }) => (
          <ProjectCard
            project={project}
            onEdit={handleEditProject}
            onRemove={() => handleRemoveProjects([project])}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )}
      />

      <ProjectDialog
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
