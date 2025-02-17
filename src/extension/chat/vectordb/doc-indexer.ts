import path from 'path'
import { EmbeddingManager } from '@extension/ai/embeddings/embedding-manager'
import { getSemanticHashName } from '@extension/file-utils/paths'
import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'

import { CodeChunkerManager, type TextChunk } from '../tree-sitter/code-chunker'
import { ProgressReporter } from '../utils/progress-reporter'
import { BasePGVectorIndexer, type IndexRow } from './base-pgvector-indexer'

export interface DocChunkRow extends IndexRow {}

export class DocIndexer extends BasePGVectorIndexer<DocChunkRow> {
  constructor(
    private docsRootSchemeUri: string,
    dbPath: string
  ) {
    super(dbPath)
    this.progressReporter = new ProgressReporter()
  }

  async getTableName(): Promise<string> {
    const { modelName } = EmbeddingManager.getInstance().getActiveModelInfo()
    const semanticModelName = getSemanticHashName(modelName)
    const docPathName = getSemanticHashName(
      path.basename(this.docsRootSchemeUri),
      this.docsRootSchemeUri
    )

    return `doc_chunks_embeddings_${semanticModelName}_${docPathName}`
  }

  async indexFile(schemeUri: string): Promise<void> {
    try {
      const rows = await this.createDocChunkRows(schemeUri)
      await this.addRows(rows)
      logger.log(`Indexed file: ${schemeUri}`)
    } catch (error) {
      logger.error(`Error indexing file ${schemeUri}:`, error)
      throw error
    }
  }

  private async createDocChunkRows(schemeUri: string): Promise<DocChunkRow[]> {
    const chunks = await this.chunkCodeFile(schemeUri)

    const chunkRowsPromises = chunks.map(async chunk => {
      const embedding = await this.embeddings.embedQuery(chunk.text)
      const fileHash = await this.generateFileHash(schemeUri)
      return {
        schemeUri,
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

  private async chunkCodeFile(schemeUri: string): Promise<TextChunk[]> {
    const chunker =
      await CodeChunkerManager.getInstance().getChunkerFromFilePath(schemeUri)
    const content = await vfs.promises.readFile(schemeUri, 'utf-8')
    const { maxTokens } = EmbeddingManager.getInstance().getActiveModelInfo()

    return chunker.chunkCode(content, {
      maxTokenLength: maxTokens,
      removeDuplicates: true
    })
  }

  async getAllIndexedFileSchemeUris(): Promise<string[]> {
    return traverseFileOrFolders({
      type: 'file',
      schemeUris: [this.docsRootSchemeUri],
      isGetFileContent: false,
      customShouldIgnore: (schemeUri: string) =>
        !this.isAvailableFile(schemeUri),
      itemCallback: fileInfo => fileInfo.schemeUri
    })
  }

  isAvailableFile(schemeUri: string): boolean {
    return schemeUri.endsWith('.md')
  }

  async indexWorkspace(): Promise<void> {
    const schemeUris = await this.getAllIndexedFileSchemeUris()
    this.progressReporter.setTotalItems(schemeUris.length)
    for (const schemeUri of schemeUris) {
      await this.indexFile(schemeUri)
      this.progressReporter.incrementProcessedItems()
    }
  }
}
