import { FileIcon } from '@webview/components/file-icon'
import { Tree, type TreeNodeRenderProps } from '@webview/components/tree'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@webview/components/ui/alert-dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@webview/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@webview/components/ui/dialog'
import { Input } from '@webview/components/ui/input'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { cn } from '@webview/utils/common'
import { getFileNameFromPath } from '@webview/utils/path'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCodeExplorerContext } from './context/code-explorer-context'
import { useCodeExplorerTree } from './hooks/use-code-explorer-tree'

interface CodeExplorerProps {
  className?: string
}

export const CodeExplorer = ({ className }: CodeExplorerProps) => {
  const {
    files,
    activeFile,
    handleFileSelect,
    handleNewFile,
    handleNewFolder,
    handleDelete,
    handleRename,
    renameDialog,
    setRenameDialog,
    deleteDialog,
    setDeleteDialog
  } = useCodeExplorerContext()
  const { t } = useTranslation()

  const { treeItems, expandedItemIds, handleExpand } = useCodeExplorerTree({
    files,
    activeFile
  })

  const renderItem = ({
    item,
    isExpanded,
    onToggleExpand,
    level
  }: TreeNodeRenderProps) => {
    const isFolder = !item.isLeaf
    const ArrowIcon = isExpanded ? ChevronDownIcon : ChevronRightIcon

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <motion.div
            className={cn(
              'flex items-center py-1 text-sm cursor-pointer rounded-sm',
              activeFile?.path === item.id && 'bg-secondary'
            )}
            style={{ marginLeft: `${level * 20}px` }}
            onClick={() => {
              if (isFolder) {
                onToggleExpand()
              } else {
                handleFileSelect(item.id)
              }
            }}
            initial="initial"
            animate="animate"
            variants={{
              initial: {
                backgroundColor:
                  activeFile?.path === item.id
                    ? 'hsl(var(--secondary))'
                    : 'transparent'
              },
              animate: {
                backgroundColor:
                  activeFile?.path === item.id
                    ? 'hsl(var(--secondary))'
                    : 'transparent'
              },
              hover: {
                backgroundColor: 'hsl(var(--secondary))',
                transition: { duration: 0.2 }
              }
            }}
            whileHover="hover"
            whileTap={{ scale: 0.98 }}
          >
            {!item.isLeaf && (
              <motion.div
                initial={false}
                animate={{
                  rotate: 0,
                  transformOrigin: 'center'
                }}
                transition={{
                  duration: 0.2,
                  ease: 'easeInOut'
                }}
                className="flex items-center justify-center w-4 h-4 mr-1"
              >
                <ArrowIcon className="size-4" />
              </motion.div>
            )}
            <FileIcon
              className="size-4 mr-1"
              isFolder={isFolder}
              isOpen={isExpanded}
              filePath={item.name}
            />
            <span className="select-none">
              {getFileNameFromPath(item.name)}
            </span>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isFolder ? (
            <>
              <ContextMenuItem onClick={() => handleNewFile(item.id)}>
                <FilePlusIcon className="size-4 mr-2" />
                {t('webview.webvm.code.newFile')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleNewFolder(item.id)}>
                <FolderPlusIcon className="size-4 mr-2" />
                {t('webview.webvm.code.newFolder')}
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={() =>
                  setDeleteDialog({
                    open: true,
                    path: item.id,
                    name: item.name,
                    isFolder: true
                  })
                }
              >
                <TrashIcon className="size-4 mr-2" />
                {t('webview.common.delete')}
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem
                onClick={() =>
                  setRenameDialog({
                    open: true,
                    path: item.id,
                    initialName: item.name,
                    newName: item.name
                  })
                }
              >
                <PencilIcon className="size-4 mr-2" />
                {t('webview.webvm.code.rename')}
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={() =>
                  setDeleteDialog({
                    open: true,
                    path: item.id,
                    name: item.name,
                    isFolder: false
                  })
                }
              >
                <TrashIcon className="size-4 mr-2" />
                {t('webview.common.delete')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div className={className}>
      <ContextMenu>
        <ContextMenuTrigger>
          <ScrollArea className="h-full">
            <AnimatePresence>
              <Tree
                className="select-none"
                items={treeItems}
                expandedItemIds={expandedItemIds}
                onExpand={handleExpand}
                renderItem={renderItem}
              />
            </AnimatePresence>
          </ScrollArea>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleNewFile('')}>
            <FilePlusIcon className="size-4 mr-2" />
            {t('webview.webvm.code.newFile')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleNewFolder('')}>
            <FolderPlusIcon className="size-4 mr-2" />
            {t('webview.webvm.code.newFolder')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog
        open={renameDialog.open}
        onOpenChange={open => setRenameDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webview.webvm.code.renameFile')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDialog.newName}
            onChange={e =>
              setRenameDialog(prev => ({ ...prev, newName: e.target.value }))
            }
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleRename(renameDialog.path, renameDialog.newName)
              }
            }}
          />
          <DialogFooter>
            <button
              onClick={() =>
                handleRename(renameDialog.path, renameDialog.newName)
              }
            >
              {t('webview.webvm.code.rename')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('webview.common.areYouSure')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.isFolder
                ? t('webview.webvm.code.deleteFolderConfirmation', {
                    name: deleteDialog.name
                  })
                : t('webview.webvm.code.deleteFileConfirmation', {
                    name: deleteDialog.name
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('webview.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteDialog.path)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('webview.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
