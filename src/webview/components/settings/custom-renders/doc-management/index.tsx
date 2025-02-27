import { useState } from 'react'
import type { DocSite } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DocSiteCard } from './doc-site-card'
import { DocSiteDialog } from './doc-site-dialog'

// Query key for doc sites
const docSitesQueryKey = ['docSites'] as const

export const DocManagement = () => {
  const { t } = useTranslation()
  const { invalidateQueries } = useInvalidateQueries()
  const [siteName, setSiteName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Queries
  const { data: docSites = [] } = useQuery({
    queryKey: [...docSitesQueryKey, searchQuery],
    queryFn: ({ signal }) =>
      searchQuery
        ? api.actions().server.doc.searchDocSites({
            actionParams: { query: searchQuery },
            abortController: signalToController(signal)
          })
        : api.actions().server.doc.getDocSites({
            actionParams: {},
            abortController: signalToController(signal)
          })
  })

  // Mutations
  const addSiteMutation = useMutation({
    mutationFn: (data: { name: string; url: string }) =>
      api.actions().server.doc.addDocSite({
        actionParams: data
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: docSitesQueryKey
      })
      toast.success(t('webview.docSite.addedSuccess'))
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError(t('webview.docSite.failedToAdd'), error)
    }
  })

  const updateSiteMutation = useMutation({
    mutationFn: (data: { id: string; name: string; url: string }) =>
      api.actions().server.doc.updateDocSite({
        actionParams: data
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: docSitesQueryKey
      })
      toast.success(t('webview.docSite.updatedSuccess'))
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError(t('webview.docSite.failedToUpdate'), error)
    }
  })

  const removeSitesMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.doc.removeDocSites({
        actionParams: { ids }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: docSitesQueryKey
      })
      toast.success(t('webview.docSite.removedSuccess'))
    },
    onError: error => {
      logAndToastError(t('webview.docSite.failedToRemove'), error)
    }
  })

  const handleSaveSite = async () => {
    if (!siteName || !siteUrl) return

    if (editingSiteId) {
      updateSiteMutation.mutate({
        id: editingSiteId,
        name: siteName,
        url: siteUrl
      })
    } else {
      addSiteMutation.mutate({
        name: siteName,
        url: siteUrl
      })
    }
  }

  const handleEditSite = (site: DocSite) => {
    setEditingSiteId(site.id)
    setSiteName(site.name)
    setSiteUrl(site.url)
    setIsDialogOpen(true)
  }

  const handleOpenDialog = () => {
    clearSiteFields()
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    clearSiteFields()
  }

  const handleRemoveSites = (items: DocSite[]) => {
    removeSitesMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearSiteFields = () => {
    setSiteName('')
    setSiteUrl('')
    setEditingSiteId(null)
  }

  return (
    <div className="space-y-4">
      <CardList
        items={docSites}
        idField="id"
        draggable={false}
        minCardWidth={300}
        onCreateItem={handleOpenDialog}
        onDeleteItems={handleRemoveSites}
        headerLeftActions={
          <Input
            placeholder={t('webview.docSite.searchPlaceholder')}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: site, isSelected, onSelect }) => (
          <DocSiteCard
            site={site}
            onEdit={handleEditSite}
            onRemove={() => handleRemoveSites([site])}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )}
      />

      <DocSiteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        loading={addSiteMutation.isPending || updateSiteMutation.isPending}
        siteName={siteName}
        siteUrl={siteUrl}
        onSiteNameChange={setSiteName}
        onSiteUrlChange={setSiteUrl}
        onSave={handleSaveSite}
        editingSite={
          editingSiteId
            ? docSites.find(site => site.id === editingSiteId)
            : undefined
        }
      />
    </div>
  )
}
