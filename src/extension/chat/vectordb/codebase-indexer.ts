import { EmbeddingManager } from '@extension/ai/embeddings/embedding-manager'
import { createShouldIgnore } from '@extension/file-utils/ignore-patterns'
import { getExt, getSemanticHashName } from '@extension/file-utils/paths'
import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import { languageIdExts } from '@shared/utils/vscode-lang'
import { Schema } from 'apache-arrow'

import { CodeChunkerManager, type TextChunk } from '../tree-sitter/code-chunker'
import { treeSitterExtLanguageMap } from '../tree-sitter/constants'
import {
  BaseIndexer,
  createBaseTableSchemaFields,
  IndexRow
} from './base-indexer'

export interface CodeChunkRow extends IndexRow {}

export class CodebaseIndexer extends BaseIndexer<CodeChunkRow> {
  async getTableName(): Promise<string> {
    const { modelName } = EmbeddingManager.getInstance().getActiveModelInfo()
    const semanticModelName = getSemanticHashName(modelName)
    return `code_chunks_embeddings_${semanticModelName}`
  }

  getTableSchema(dimensions: number): Schema<any> {
    return new Schema([...createBaseTableSchemaFields(dimensions)])
  }

  async indexFile(fileSchemeUri: string): Promise<void> {
    try {
      const rows = await this.createCodeChunkRows(fileSchemeUri)
      await this.addRows(rows)
      logger.log(`Indexed file: ${fileSchemeUri}`)
    } catch (error) {
      logger.error(`Error indexing file ${fileSchemeUri}:`, error)
      throw error
    }
  }

  private async createCodeChunkRows(
    fileSchemeUri: string
  ): Promise<CodeChunkRow[]> {
    const chunks = await this.chunkCodeFile(fileSchemeUri)
    const relativePath = vfs.resolveRelativePathProSync(fileSchemeUri)

    const chunkRowsPromises = chunks.map(async chunk => {
      const embedding = await this.embeddings.embedQuery(
        `file path: ${relativePath}\n\n${chunk.text}`
      )
      const fileHash = await this.generateFileHash(fileSchemeUri)
      return {
        schemeUri: fileSchemeUri,
        fileHash,
        startLine: chunk.range.startLine,
        startCharacter: chunk.range.startColumn,
        endLine: chunk.range.endLine,
        endCharacter: chunk.range.endColumn,
        embedding
      }
    })

    return settledPromiseResults(chunkRowsPromises)
  }

  private async chunkCodeFile(fileSchemeUri: string): Promise<TextChunk[]> {
    const chunker =
      await CodeChunkerManager.getInstance().getChunkerFromFilePath(
        fileSchemeUri
      )
    const content = await vfs.promises.readFile(fileSchemeUri, 'utf-8')
    const { maxTokens } = EmbeddingManager.getInstance().getActiveModelInfo()

    return chunker.chunkCode(content, {
      maxTokenLength: maxTokens,
      removeDuplicates: true
    })
  }

  async getAllIndexedFileSchemeUris(): Promise<string[]> {
    const workspaceSchemeUri = workspaceSchemeHandler.createSchemeUri({
      relativePath: './'
    })
    const shouldIgnore = await createShouldIgnore(workspaceSchemeUri)

    return await traverseFileOrFolders({
      type: 'file',
      schemeUris: [workspaceSchemeUri],
      isGetFileContent: false,
      customShouldIgnore: (schemeUri: string) =>
        shouldIgnore(schemeUri) || !this.isAvailableExtFile(schemeUri, true),
      itemCallback: fileInfo => fileInfo.schemeUri
    })
  }

  private isAvailableExtFile(
    fileSchemeUri: string,
    allowFolder = false
  ): boolean {
    const allowExt = new Set([
      ...Object.keys(treeSitterExtLanguageMap),
      ...languageIdExts
    ])
    const ext = getExt(fileSchemeUri)!.toLowerCase()

    if (!ext) return allowFolder

    return allowExt.has(ext)
  }

  async isAvailableFile(fileSchemeUri: string): Promise<boolean> {
    const workspaceSchemeUri = workspaceSchemeHandler.createSchemeUri({
      relativePath: './'
    })
    const shouldIgnore = await createShouldIgnore(workspaceSchemeUri)
    return (
      !shouldIgnore(fileSchemeUri) && this.isAvailableExtFile(fileSchemeUri)
    )
  }
}
