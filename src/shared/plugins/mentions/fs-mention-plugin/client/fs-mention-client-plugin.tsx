import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import { UriScheme } from '@extension/file-utils/vfs/helpers/types'
import {
  CardStackIcon,
  CubeIcon,
  DashboardIcon,
  ExclamationTriangleIcon,
  GearIcon
} from '@radix-ui/react-icons'
import type { GitProject, GitProjectType, Project } from '@shared/entities'
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
import { useOpenSettingsPage } from '@webview/hooks/api/use-open-settings-page'
import { api } from '@webview/network/actions-api'
import { SearchSortStrategy, type MentionOption } from '@webview/types/chat'
import { getFileNameFromPath } from '@webview/utils/path'
import { optimizeSchemeUriRender } from '@webview/utils/scheme-uri'
import {
  ChevronRightIcon,
  FileIcon,
  FolderGit2Icon,
  FolderTreeIcon
} from 'lucide-react'

import { FsMentionType, type TreeInfo } from '../types'
import { BitbucketIcon, GithubIcon, GitlabIcon } from './icons'
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
    const { openSettingsPage } = useOpenSettingsPage()
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

    const { data: projects = [] } = useQuery({
      queryKey: ['realtime', 'projects'],
      queryFn: () =>
        api.actions().server.project.getProjects({
          actionParams: {}
        })
    })

    const { data: projectFilesAndFolders = {} } = useQuery({
      queryKey: ['realtime', 'projectFilesAndFolders'],
      queryFn: () =>
        api.actions().server.project.getProjectFilesAndFolders({
          actionParams: {}
        }),
      enabled: projects.length > 0
    })

    const { data: gitProjects = [] } = useQuery({
      queryKey: ['realtime', 'gitProjects'],
      queryFn: () =>
        api.actions().server.gitProject.getGitProjects({
          actionParams: {}
        })
    })

    const { data: gitProjectFilesAndFolders = {} } = useQuery({
      queryKey: ['realtime', 'gitProjectFilesAndFolders'],
      queryFn: () =>
        api.actions().server.gitProject.getGitProjectFilesAndFolders({
          actionParams: {}
        }),
      enabled: gitProjects.length > 0
    })

    const filesMentionOptions: MentionOption[] = files.map(file => {
      const label = getFileNameFromPath(file.schemeUri)
      const { path } = SchemeUriHelper.parse(file.schemeUri, false)
      const schemeUriForRender = optimizeSchemeUriRender(file.schemeUri)

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
          details: schemeUriForRender
        },
        customRenderPreview: MentionFilePreview
      } satisfies MentionOption<FileInfo>
    })

    const foldersMentionOptions: MentionOption[] = folders.map(folder => {
      const label = getFileNameFromPath(folder.schemeUri) || 'ROOT'
      const { path } = SchemeUriHelper.parse(folder.schemeUri, false)
      const schemeUriForRender = optimizeSchemeUriRender(folder.schemeUri)

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
                filePath={schemeUriForRender}
              />
            </>
          ),
          label,
          details: schemeUriForRender
        },
        customRenderPreview: MentionFolderPreview
      } satisfies MentionOption<FolderInfo>
    })

    const treesMentionOptions: MentionOption[] = treesInfo.map(treeInfo => {
      const label = getFileNameFromPath(treeInfo.schemeUri) || 'ROOT'
      const { path } = SchemeUriHelper.parse(treeInfo.schemeUri, false)
      const schemeUriForRender = optimizeSchemeUriRender(treeInfo.schemeUri)

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
          details: schemeUriForRender
        },
        customRenderPreview: MentionTreePreview
      } satisfies MentionOption<TreeInfo>
    })

    const localProjectSettingMentionOption: MentionOption = {
      id: FsMentionType.ProjectSetting,
      type: FsMentionType.ProjectSetting,
      label: 'Local Projects setting',
      disableAddToEditor: true,
      onSelect: () => {
        openSettingsPage({ pageId: 'projectManagement' })
      },
      searchKeywords: [
        'setting',
        'local',
        'projectsetting',
        'localprojectssetting'
      ],
      itemLayoutProps: {
        icon: <GearIcon className="size-4 mr-1" />,
        label: 'Local projects setting',
        details: ''
      }
    }

    const localProjectMentionOptions: MentionOption[] = projects.map(
      project => {
        const projectItems = projectFilesAndFolders[project.id] || []
        const fileOptions: MentionOption<FileInfo>[] = []
        const folderOptions: MentionOption<FolderInfo>[] = []

        projectItems.forEach(item => {
          const label = getFileNameFromPath(item.schemeUri) || 'ROOT'
          const { path } = SchemeUriHelper.parse(item.schemeUri, false)
          const schemeUriForRender = optimizeSchemeUriRender(item.schemeUri, {
            removeSchemes: [UriScheme.Project],
            removePathPrefixPart: 1
          })

          if (item.type === 'file') {
            fileOptions.push({
              id: `${FsMentionType.ProjectFile}#${item.schemeUri}`,
              type: FsMentionType.ProjectFile,
              label,
              labelForInsertEditor: item.schemeUri,
              data: item,
              searchKeywords: [path, label],
              searchSortStrategy: SearchSortStrategy.EndMatch,
              itemLayoutProps: {
                icon: (
                  <FileIcon2
                    className="size-4 mr-1"
                    filePath={item.schemeUri}
                  />
                ),
                label,
                details: schemeUriForRender
              },
              customRenderPreview: MentionFilePreview
            })
          } else {
            folderOptions.push({
              id: `${FsMentionType.ProjectFolder}#${item.schemeUri}`,
              type: FsMentionType.ProjectFolder,
              label,
              labelForInsertEditor: item.schemeUri,
              data: item,
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
                      filePath={item.schemeUri}
                    />
                  </>
                ),
                label,
                details: schemeUriForRender
              },
              customRenderPreview: MentionFolderPreview
            })
          }
        })

        return {
          id: `${FsMentionType.Project}#${project.name}`,
          type: FsMentionType.Project,
          label: project.name,
          data: project,
          searchKeywords: [project.name, project.path],
          searchSortStrategy: SearchSortStrategy.EndMatch,
          itemLayoutProps: {
            icon: <DashboardIcon className="size-4 mr-1" />,
            label: project.name,
            details: project.path
          },
          children: [...fileOptions, ...folderOptions]
        } satisfies MentionOption<Project>
      }
    )

    const gitProjectSettingMentionOption: MentionOption = {
      id: FsMentionType.GitProjectSetting,
      type: FsMentionType.GitProjectSetting,
      label: 'Git Projects setting',
      disableAddToEditor: true,
      onSelect: () => {
        openSettingsPage({ pageId: 'gitProjectManagement' })
      },
      searchKeywords: [
        'setting',
        'git',
        'projectsetting',
        'gitprojectssetting'
      ],
      itemLayoutProps: {
        icon: <GearIcon className="size-4 mr-1" />,
        label: 'Git projects setting',
        details: ''
      }
    }

    const gitProjectMentionOptions: MentionOption[] = gitProjects.map(
      project => {
        const projectItems = gitProjectFilesAndFolders[project.id] || []
        const fileOptions: MentionOption<FileInfo>[] = []
        const folderOptions: MentionOption<FolderInfo>[] = []

        projectItems.forEach(item => {
          const label = getFileNameFromPath(item.schemeUri) || 'ROOT'
          const { path } = SchemeUriHelper.parse(item.schemeUri, false)
          const schemeUriForRender = optimizeSchemeUriRender(item.schemeUri, {
            removeSchemes: [UriScheme.GitProject],
            removePathPrefixPart: 2
          })

          if (item.type === 'file') {
            fileOptions.push({
              id: `${FsMentionType.GitProjectFile}#${item.schemeUri}`,
              type: FsMentionType.GitProjectFile,
              label,
              labelForInsertEditor: item.schemeUri,
              data: item,
              searchKeywords: [path, label],
              searchSortStrategy: SearchSortStrategy.EndMatch,
              itemLayoutProps: {
                icon: (
                  <FileIcon2
                    className="size-4 mr-1"
                    filePath={item.schemeUri}
                  />
                ),
                label,
                details: schemeUriForRender
              },
              customRenderPreview: MentionFilePreview
            })
          } else {
            folderOptions.push({
              id: `${FsMentionType.GitProjectFolder}#${item.schemeUri}`,
              type: FsMentionType.GitProjectFolder,
              label,
              labelForInsertEditor: item.schemeUri,
              data: item,
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
                      filePath={item.schemeUri}
                    />
                  </>
                ),
                label,
                details: schemeUriForRender
              },
              customRenderPreview: MentionFolderPreview
            })
          }
        })

        const typeIconMap: Record<
          GitProjectType,
          React.FC<React.SVGProps<SVGSVGElement>>
        > = {
          github: GithubIcon,
          gitlab: GitlabIcon,
          bitbucket: BitbucketIcon
        }
        const Icon = typeIconMap[project.type]

        return {
          id: `${FsMentionType.GitProject}#${project.name}`,
          type: FsMentionType.GitProject,
          label: project.name,
          data: project,
          searchKeywords: [project.name, project.repoUrl, project.type],
          searchSortStrategy: SearchSortStrategy.EndMatch,
          itemLayoutProps: {
            icon: <Icon className="size-4 mr-1" />,
            label: project.name,
            details: project.repoUrl
          },
          children: [...fileOptions, ...folderOptions]
        } satisfies MentionOption<GitProject>
      }
    )

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
        topLevelSort: editorErrors.length > 0 ? 7 : -1,
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
      },
      {
        id: FsMentionType.Projects,
        type: FsMentionType.Projects,
        label: 'Local Projects',
        topLevelSort: 8,
        searchKeywords: ['projects', 'local', 'localprojects'],
        children: [
          localProjectSettingMentionOption,
          ...localProjectMentionOptions
        ],
        itemLayoutProps: {
          icon: <DashboardIcon className="size-4 mr-1" />,
          label: 'Local Projects'
        }
      },
      {
        id: FsMentionType.GitProjects,
        type: FsMentionType.GitProjects,
        label: 'Git Projects',
        topLevelSort: 9,
        searchKeywords: ['git', 'projects', 'repositories', 'gitprojects'],
        children: [gitProjectSettingMentionOption, ...gitProjectMentionOptions],
        itemLayoutProps: {
          icon: <FolderGit2Icon className="size-4 mr-1" />,
          label: 'Git Projects'
        }
      }
    ]
  }
