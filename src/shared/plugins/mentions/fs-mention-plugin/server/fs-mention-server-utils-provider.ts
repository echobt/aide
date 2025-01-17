import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import type { ActionRegister } from '@extension/registers/action-register'
import type { GitProject, Mention, Project } from '@shared/entities'
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

    const projects = await actionRegister.actions().server.project.getProjects({
      actionParams: {}
    })

    const gitProjects = await actionRegister
      .actions()
      .server.gitProject.getGitProjects({
        actionParams: {}
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

    const projectIdMapProject = new Map<string, Project>()
    for (const project of projects) {
      projectIdMapProject.set(project.id, project)
    }

    const gitProjectIdMapProject = new Map<string, GitProject>()
    for (const project of gitProjects) {
      gitProjectIdMapProject.set(project.id, project)
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

        case FsMentionType.Project:
          const project = projectIdMapProject.get(mention.data.id)
          if (project) mention.data = project
          break

        case FsMentionType.GitProject:
          const gitProject = gitProjectIdMapProject.get(mention.data.id)
          if (gitProject) mention.data = gitProject
          break

        default:
          break
      }

      return mention
    }
  }
}
