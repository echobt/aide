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
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon
} from 'lucide-react'

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
          <div
            className={cn(
              'flex items-center py-1 text-sm cursor-pointer hover:bg-secondary rounded-sm',
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
          >
            {!item.isLeaf && <ArrowIcon className="size-4 mr-1" />}
            <FileIcon
              className="size-4 mr-1"
              isFolder={isFolder}
              isOpen={isExpanded}
              filePath={item.name}
            />
            <span className="select-none">
              {getFileNameFromPath(item.name)}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isFolder ? (
            <>
              <ContextMenuItem onClick={() => handleNewFile(item.id)}>
                <FilePlusIcon className="size-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleNewFolder(item.id)}>
                <FolderPlusIcon className="size-4 mr-2" />
                New Folder
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
                Delete
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
                Rename
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
                Delete
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
            <Tree
              className="select-none"
              items={treeItems}
              expandedItemIds={expandedItemIds}
              onExpand={handleExpand}
              renderItem={renderItem}
            />
          </ScrollArea>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleNewFile('')}>
            <FilePlusIcon className="size-4 mr-2" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleNewFolder('')}>
            <FolderPlusIcon className="size-4 mr-2" />
            New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog
        open={renameDialog.open}
        onOpenChange={open => setRenameDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
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
              Rename
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.isFolder
                ? `This will delete the folder "${deleteDialog.name}" and all its contents.`
                : `This will delete the file "${deleteDialog.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteDialog.path)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
