import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import type { WebPreviewProjectFile } from '@shared/entities'
import { toast } from 'sonner'

interface RenameDialog {
  open: boolean
  path: string
  initialName: string
  newName: string
}

interface DeleteDialog {
  open: boolean
  path: string
  name: string
  isFolder: boolean
}

interface CodeExplorerContextValue {
  readonly?: boolean
  files: WebPreviewProjectFile[]
  setFiles: React.Dispatch<React.SetStateAction<WebPreviewProjectFile[]>>
  activeFile: WebPreviewProjectFile | null
  setActiveFile: React.Dispatch<
    React.SetStateAction<WebPreviewProjectFile | null>
  >
  preVersionFiles: WebPreviewProjectFile[] | undefined
  expandedItemIds: string[]
  setExpandedItemIds: React.Dispatch<React.SetStateAction<string[]>>
  handleFileSelect: (path: string) => void
  handleNewFile: (parentPath: string) => void
  handleNewFolder: (parentPath: string) => void
  handleDelete: (path: string) => void
  handleRename: (path: string, newName: string) => void
  renameDialog: RenameDialog
  setRenameDialog: React.Dispatch<React.SetStateAction<RenameDialog>>
  deleteDialog: DeleteDialog
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialog>>
}

const CodeExplorerContext = createContext<CodeExplorerContextValue | null>(null)

interface CodeExplorerProviderProps {
  children: ReactNode
  value: Pick<
    CodeExplorerContextValue,
    | 'files'
    | 'setFiles'
    | 'preVersionFiles'
    | 'readonly'
    | 'activeFile'
    | 'setActiveFile'
  >
}

export const CodeExplorerProvider = ({
  children,
  value
}: CodeExplorerProviderProps) => {
  const {
    files,
    setFiles,
    preVersionFiles,
    readonly,
    activeFile,
    setActiveFile
  } = value
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([])

  useEffect(() => {
    if (files.length > 0) {
      setActiveFile(prev => (!prev ? files[0]! : prev))
    }
  }, [files])

  const [renameDialog, setRenameDialog] = useState<RenameDialog>({
    open: false,
    path: '',
    initialName: '',
    newName: ''
  })
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog>({
    open: false,
    path: '',
    name: '',
    isFolder: false
  })

  const handleFileSelect = (path: string) => {
    const file = files.find(f => f.path === path)
    if (file) {
      setActiveFile(file)
    }
  }

  const toastReadonlyError = () => {
    toast.error('This project is not active. You can not edit files.')
  }

  const handleNewFile = (parentPath: string) => {
    if (readonly) {
      toastReadonlyError()
      return
    }
    const newPath = `${parentPath}/new-file.txt`
    const newFiles = [...files, { path: newPath, content: '' }]
    setFiles(newFiles)
  }

  const handleNewFolder = (parentPath: string) => {
    if (readonly) {
      toastReadonlyError()
      return
    }
    const newPath = `${parentPath}/new-folder`
    // folder represented by sub files
    const newFiles = [...files, { path: `${newPath}/.gitkeep`, content: '' }]
    setFiles(newFiles)
  }

  const handleDelete = (path: string) => {
    if (readonly) {
      toastReadonlyError()
      return
    }
    const newFiles = files.filter(f => !f.path.startsWith(path))
    setFiles(newFiles)
    setDeleteDialog(prev => ({ ...prev, open: false }))
  }

  const handleRename = (path: string, newName: string) => {
    if (readonly) {
      toastReadonlyError()
      return
    }
    const file = files.find(f => f.path === path)
    if (!file) return

    const dirPath = path.split('/').slice(0, -1).join('/')
    const newPath = dirPath ? `${dirPath}/${newName}` : newName
    const newFiles = files.map(f =>
      f.path === path ? { ...f, path: newPath } : f
    )

    setFiles(newFiles)
    setRenameDialog(prev => ({ ...prev, open: false }))
  }

  return (
    <CodeExplorerContext.Provider
      value={{
        ...value,
        readonly,
        files,
        setFiles,
        activeFile,
        expandedItemIds,
        setExpandedItemIds,
        preVersionFiles,
        handleFileSelect,
        handleNewFile,
        handleNewFolder,
        handleDelete,
        handleRename,
        renameDialog,
        setRenameDialog,
        deleteDialog,
        setDeleteDialog
      }}
    >
      {children}
    </CodeExplorerContext.Provider>
  )
}

export const useCodeExplorerContext = () => {
  const context = useContext(CodeExplorerContext)
  if (!context) {
    throw new Error(
      'useCodeExplorerContext must be used within a CodeExplorerProvider'
    )
  }
  return context
}
