import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import {
  CardStackIcon,
  CubeIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import { useQuery } from '@tanstack/react-query'
import { FileIcon as FileIcon2 } from '@webview/components/file-icon'
import { api } from '@webview/network/actions-api'
import { SearchSortStrategy, type MentionOption } from '@webview/types/chat'
import { getFileNameFromPath } from '@webview/utils/path'
import { ChevronRightIcon, FileIcon, FolderTreeIcon } from 'lucide-react'

import { FsMentionType, type TreeInfo } from '../types'
import { MentionFilePreview } from './mention-file-preview'
import { MentionFolderPreview } from './mention-folder-preview'
import { MentionTreePreview } from './mention-tree-preview'

export const FsMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Fs,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const { data: files = [] } = useQuery({
      queryKey: ['realtime', 'files'],
      queryFn: () =>
        api.actions().server.file.traverseWorkspaceFiles({
          actionParams: {
            schemeUris: ['./']
          }
        })
    })

    const { data: folders = [] } = useQuery({
      queryKey: ['realtime', 'folders'],
      queryFn: () =>
        api.actions().server.file.traverseWorkspaceFolders({
          actionParams: {
            schemeUris: ['./']
          }
        })
    })

    const { data: editorErrors = [] } = useQuery({
      queryKey: ['realtime', 'editorErrors'],
      queryFn: () =>
        api.actions().server.file.getCurrentEditorErrors({
          actionParams: {}
        })
    })

    const { data: treesInfo = [] } = useQuery({
      queryKey: ['realtime', 'treesInfo'],
      queryFn: () =>
        api.actions().server.file.getWorkspaceTreesInfo({
          actionParams: {
            depth: 5
          }
        })
    })

    const filesMentionOptions: MentionOption[] = files.map(file => {
      const label = getFileNameFromPath(file.schemeUri)
      const { path } = SchemeUriHelper.parse(file.schemeUri, false)

      return {
        id: `${FsMentionType.File}#${file.schemeUri}`,
        type: FsMentionType.File,
        label,
        data: file,
        searchKeywords: [path, label],
        searchSortStrategy: SearchSortStrategy.EndMatch,
        itemLayoutProps: {
          icon: <FileIcon2 className="size-4 mr-1" filePath={file.schemeUri} />,
          label,
          details: file.schemeUri
        },
        customRenderPreview: MentionFilePreview
      } satisfies MentionOption<FileInfo>
    })

    const foldersMentionOptions: MentionOption[] = folders.map(folder => {
      const label = getFileNameFromPath(folder.schemeUri)
      const { path } = SchemeUriHelper.parse(folder.schemeUri, false)

      return {
        id: `${FsMentionType.Folder}#${folder.schemeUri}`,
        type: FsMentionType.Folder,
        label,
        data: folder,
        searchKeywords: [path, label],
        searchSortStrategy: SearchSortStrategy.EndMatch,
        itemLayoutProps: {
          icon: (
            <>
              <ChevronRightIcon className="size-4 mr-1" />
              <FileIcon2
                className="size-4 mr-1"
                isFolder
                isOpen={false}
                filePath={folder.schemeUri}
              />
            </>
          ),
          label,
          details: folder.schemeUri
        },
        customRenderPreview: MentionFolderPreview
      } satisfies MentionOption<FolderInfo>
    })

    const treesMentionOptions: MentionOption[] = treesInfo.map(treeInfo => {
      const label = getFileNameFromPath(treeInfo.schemeUri)
      const { path } = SchemeUriHelper.parse(treeInfo.schemeUri, false)

      return {
        id: `${FsMentionType.Tree}#${treeInfo.schemeUri}`,
        type: FsMentionType.Tree,
        label,
        data: treeInfo,
        searchKeywords: [path, label],
        searchSortStrategy: SearchSortStrategy.EndMatch,
        itemLayoutProps: {
          icon: <FolderTreeIcon className="size-4 mr-1" />,
          label,
          details: treeInfo.schemeUri
        },
        customRenderPreview: MentionTreePreview
      } satisfies MentionOption<TreeInfo>
    })

    return [
      {
        id: FsMentionType.Files,
        type: FsMentionType.Files,
        label: 'Files',
        topLevelSort: 0,
        searchKeywords: ['files'],
        children: filesMentionOptions,
        itemLayoutProps: {
          icon: <FileIcon className="size-4 mr-1" />,
          label: 'Files'
        }
      },
      {
        id: FsMentionType.Folders,
        type: FsMentionType.Folders,
        label: 'Folders',
        topLevelSort: 1,
        searchKeywords: ['folders'],
        children: foldersMentionOptions,
        itemLayoutProps: {
          icon: <CardStackIcon className="size-4 mr-1" />,
          label: 'Folders'
        }
      },
      {
        id: FsMentionType.Trees,
        type: FsMentionType.Trees,
        label: 'Tree',
        topLevelSort: 2,
        searchKeywords: ['tree', 'structure'],
        children: treesMentionOptions,
        itemLayoutProps: {
          icon: <FolderTreeIcon className="size-4 mr-1" />,
          label: 'Tree'
        }
      },
      // {
      //   id: FsMentionType.Code,
      //   type: FsMentionType.Code,
      //   label: 'Code',
      //   topLevelSort: 2,
      //   searchKeywords: ['code'],
      //   itemLayoutProps: {
      //     icon: <CodeIcon className="size-4 mr-1" />,
      //     label: 'Code'
      //   }
      // },
      {
        id: FsMentionType.Codebase,
        type: FsMentionType.Codebase,
        label: 'Codebase',
        data: true,
        topLevelSort: 6,
        searchKeywords: ['codebase'],
        itemLayoutProps: {
          icon: <CubeIcon className="size-4 mr-1" />,
          label: 'Codebase'
        }
      },
      {
        id: FsMentionType.Errors,
        type: FsMentionType.Errors,
        label: 'Errors',
        data: editorErrors,
        topLevelSort: 7,
        searchKeywords: ['errors', 'warnings', 'diagnostics'],
        itemLayoutProps: {
          icon: <ExclamationTriangleIcon className="size-4 mr-1" />,
          label: (
            <>
              Errors
              <span className="ml-2 overflow-hidden text-ellipsis text-xs text-foreground/50 whitespace-nowrap">
                ({editorErrors.length})
              </span>
            </>
          )
        }
      }
    ]
  }
