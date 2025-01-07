import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import type { ActionRegister } from '@extension/registers/action-register'
import type { Mention } from '@shared/entities'
import type { MentionServerUtilsProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { FsMentionType, type FsMention, type TreeInfo } from '../types'

export class FsMentionServerUtilsProvider
  implements MentionServerUtilsProvider
{
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    const files = await actionRegister
      .actions()
      .server.file.traverseWorkspaceFiles({
        actionParams: {
          filesOrFolders: ['./']
        }
      })

    const folders = await actionRegister
      .actions()
      .server.file.traverseWorkspaceFolders({
        actionParams: {
          folders: ['./']
        }
      })

    const editorErrors = await actionRegister
      .actions()
      .server.file.getCurrentEditorErrors({
        actionParams: {}
      })

    const treesInfo = await actionRegister
      .actions()
      .server.file.getWorkspaceTreesInfo({
        actionParams: {
          depth: 5
        }
      })

    const filePathMapFile = new Map<string, FileInfo>()

    for (const file of files) {
      filePathMapFile.set(file.fullPath, file)
    }

    const filePathMapFolder = new Map<string, FolderInfo>()

    for (const folder of folders) {
      filePathMapFolder.set(folder.fullPath, folder)
    }

    const filePathMapTree = new Map<string, TreeInfo>()

    for (const tree of treesInfo) {
      filePathMapTree.set(tree.fullPath, tree)
    }

    return (_mention: Mention) => {
      const mention = { ..._mention } as FsMention
      switch (mention.type) {
        case FsMentionType.File:
          const file = filePathMapFile.get(mention.data.fullPath)
          if (file) mention.data = file
          break

        case FsMentionType.Folder:
          const folder = filePathMapFolder.get(mention.data.fullPath)
          if (folder) mention.data = folder
          break

        case FsMentionType.Tree:
          const tree = filePathMapTree.get(mention.data.fullPath)
          if (tree) mention.data = tree
          break

        case FsMentionType.Errors:
          mention.data = editorErrors
          break

        default:
          break
      }

      return mention
    }
  }
}
