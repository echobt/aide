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
          schemeUris: ['./']
        }
      })

    const folders = await actionRegister
      .actions()
      .server.file.traverseWorkspaceFolders({
        actionParams: {
          schemeUris: ['./']
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

    const fileSchemeUriMapFile = new Map<string, FileInfo>()

    for (const file of files) {
      fileSchemeUriMapFile.set(file.schemeUri, file)
    }

    const fileSchemeUriMapFolder = new Map<string, FolderInfo>()

    for (const folder of folders) {
      fileSchemeUriMapFolder.set(folder.schemeUri, folder)
    }

    const fileSchemeUriMapTree = new Map<string, TreeInfo>()

    for (const tree of treesInfo) {
      fileSchemeUriMapTree.set(tree.schemeUri, tree)
    }

    return (_mention: Mention) => {
      const mention = { ..._mention } as FsMention
      switch (mention.type) {
        case FsMentionType.File:
          const file = fileSchemeUriMapFile.get(mention.data.schemeUri)
          if (file) mention.data = file
          break

        case FsMentionType.Folder:
          const folder = fileSchemeUriMapFolder.get(mention.data.schemeUri)
          if (folder) mention.data = folder
          break

        case FsMentionType.Tree:
          const tree = fileSchemeUriMapTree.get(mention.data.schemeUri)
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
