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

    // Get project files and folders
    const projectFilesAndFolders = await actionRegister
      .actions()
      .server.project.getProjectFilesAndFolders({
        actionParams: {}
      })

    // Get git project files and folders
    const gitProjectFilesAndFolders = await actionRegister
      .actions()
      .server.gitProject.getGitProjectFilesAndFolders({
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

    // Create maps for project files and folders
    const projectFileSchemeUriMap = new Map<string, FileInfo>()
    const projectFolderSchemeUriMap = new Map<string, FolderInfo>()

    for (const projectId in projectFilesAndFolders) {
      const items = projectFilesAndFolders[projectId] || []
      items.forEach(item => {
        if (item.type === 'file') {
          projectFileSchemeUriMap.set(item.schemeUri, item)
        } else {
          projectFolderSchemeUriMap.set(item.schemeUri, item)
        }
      })
    }

    const gitProjectIdMapProject = new Map<string, GitProject>()
    for (const project of gitProjects) {
      gitProjectIdMapProject.set(project.id, project)
    }

    // Create maps for git project files and folders
    const gitProjectFileSchemeUriMap = new Map<string, FileInfo>()
    const gitProjectFolderSchemeUriMap = new Map<string, FolderInfo>()

    for (const projectId in gitProjectFilesAndFolders) {
      const items = gitProjectFilesAndFolders[projectId] || []
      items.forEach(item => {
        if (item.type === 'file') {
          gitProjectFileSchemeUriMap.set(item.schemeUri, item)
        } else {
          gitProjectFolderSchemeUriMap.set(item.schemeUri, item)
        }
      })
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

        case FsMentionType.ProjectFile:
          const projectFile = projectFileSchemeUriMap.get(
            mention.data.schemeUri
          )
          if (projectFile) mention.data = projectFile
          break

        case FsMentionType.ProjectFolder:
          const projectFolder = projectFolderSchemeUriMap.get(
            mention.data.schemeUri
          )
          if (projectFolder) mention.data = projectFolder
          break

        case FsMentionType.GitProject:
          const gitProject = gitProjectIdMapProject.get(mention.data.id)
          if (gitProject) mention.data = gitProject
          break

        case FsMentionType.GitProjectFile:
          const gitProjectFile = gitProjectFileSchemeUriMap.get(
            mention.data.schemeUri
          )
          if (gitProjectFile) mention.data = gitProjectFile
          break

        case FsMentionType.GitProjectFolder:
          const gitProjectFolder = gitProjectFolderSchemeUriMap.get(
            mention.data.schemeUri
          )
          if (gitProjectFolder) mention.data = gitProjectFolder
          break

        default:
          break
      }

      return mention
    }
  }
}
