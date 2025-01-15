import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { FeatureModelSettingKey } from '@shared/entities'
import { AbortError } from '@shared/utils/common'
import { z } from 'zod'

import { ModelProviderFactory } from './model-providers/helpers/factory'

export interface ReferenceFileSchemeUris {
  referenceSchemeUris: string[]
  dependenceSchemeUri: string
}

export const getReferenceFileSchemeUris = async ({
  featureModelSettingKey,
  currentSchemeUri,
  abortController
}: {
  featureModelSettingKey: FeatureModelSettingKey
  currentSchemeUri: string
  abortController?: AbortController
}): Promise<ReferenceFileSchemeUris> => {
  const allFileRelativePaths: string[] = []

  const baseUri = vfs.resolveBaseUriProSync(currentSchemeUri)

  await traverseFileOrFolders({
    type: 'file',
    schemeUris: [baseUri],
    itemCallback: fileInfo => {
      allFileRelativePaths.push(
        vfs.resolveRelativePathProSync(fileInfo.schemeUri)
      )
    }
  })

  const currentFileRelativePath =
    vfs.resolveRelativePathProSync(currentSchemeUri)

  const modelProvider = await ModelProviderFactory.getModelProvider(
    featureModelSettingKey
  )

  const zodSchema = z.object({
    referenceFileRelativePaths: z.array(z.string()).min(0).max(3).describe(`
      Required! The relative paths array of the up to three most useful files related to the currently edited file. This can include 0 to 3 files.
    `),
    dependenceFileRelativePath: z.string().describe(`
      Required! The relative path of the dependency file for the current file. If the dependency file is not found, return an empty string.
      `)
  })

  const aiRunnable = await modelProvider.createStructuredOutputRunnable({
    signal: abortController?.signal,
    useHistory: false,
    schema: zodSchema
  })

  const aiRes: z.infer<typeof zodSchema> = await aiRunnable.invoke({
    input: `
I will provide the relative paths of all current files and the path of the currently edited file.
I would like you to do two things:

1. Find the file path of the dependency file for the current file. Dependency files usually contain configuration for project dependencies. Please identify the dependency file paths based on different programming languages and common dependency file naming conventions. Here are some examples of dependency files for common programming languages:
   - JavaScript/TypeScript: package.json
   - Python: requirements.txt, Pipfile, pyproject.toml
   - Java: pom.xml, build.gradle
   - Ruby: Gemfile
   - PHP: composer.json
   - Rust: Cargo.toml

2. Identify the three most useful files related to the currently edited file. These files should be helpful for editing the current file. I will provide the contents of these files to assist in the editing process.

Please note, do not include very large files such as yarn.lock. Based on this information, please return the relative path of the dependency file for the current file and the three most useful file paths.

Here are the relative paths of all files:
${allFileRelativePaths.join('\n')}

The path of the currently edited file is:
${currentFileRelativePath}

Please find and return the dependency file path for the current file and the three most useful file paths.
    `
  })

  if (abortController?.signal.aborted) throw AbortError

  return {
    referenceSchemeUris: aiRes.referenceFileRelativePaths.map(item =>
      workspaceSchemeHandler.createSchemeUri({
        relativePath: item
      })
    ),
    dependenceSchemeUri: aiRes.dependenceFileRelativePath
      ? workspaceSchemeHandler.createSchemeUri({
          relativePath: aiRes.dependenceFileRelativePath
        })
      : ''
  }
}
