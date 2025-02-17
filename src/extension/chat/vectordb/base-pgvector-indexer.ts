import path from 'path'
import { pathToFileURL } from 'url'
import {
  PGlite,
  type ExtensionSetupResult,
  type PGliteInterface
} from '@electric-sql/pglite'
import { EmbeddingManager } from '@extension/ai/embeddings/embedding-manager'
import type { BaseEmbeddings } from '@extension/ai/embeddings/types'
import { getFileHash } from '@extension/file-utils/get-file-hash'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { extensionDistDir } from '@extension/utils'
import { settledPromiseResults } from '@shared/utils/common'

import { ProgressReporter } from '../utils/progress-reporter'

export type ReIndexType = 'full' | 'diff'

export interface IndexRow {
  id?: number
  schemeUri: string
  fileHash: string
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
  embedding: number[]
}

interface PgIndexRow {
  id?: number
  scheme_uri: string
  file_hash: string
  start_line: number
  start_character: number
  end_line: number
  end_character: number
  embedding: string // [1, 2, 3]
}

export abstract class BasePGVectorIndexer<T extends IndexRow> {
  protected pg: PGlite

  protected embeddings!: BaseEmbeddings

  protected isIndexing: boolean = false

  protected indexingQueue: string[] = []

  protected totalFiles: number = 0

  protected maxConcurrentFiles: number = 5

  progressReporter = new ProgressReporter()

  constructor(protected dbPath: string) {
    this.pg = new PGlite({
      dataDir: this.dbPath,
      extensions: {
        vector: {
          name: 'pgvector',
          setup: async (_pg: PGliteInterface, emscriptenOpts: any) =>
            ({
              emscriptenOpts,
              bundlePath: pathToFileURL(
                path.resolve(extensionDistDir, '../vector.tar.gz')
              )
            }) satisfies ExtensionSetupResult
        }
      }
    })
  }

  // Add utility functions for name conversion
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }

  private convertRowToSnakeCase(row: T): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(row)) {
      if (key === 'embedding') {
        result[this.toSnakeCase(key)] = JSON.stringify(value)
      } else {
        result[this.toSnakeCase(key)] = value
      }
    }
    return result
  }

  private convertRowToCamelCase(row: Record<string, any>): T {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(row)) {
      if (key === 'embedding') {
        result[this.toCamelCase(key)] = JSON.parse(value)
      } else {
        result[this.toCamelCase(key)] = value
      }
    }
    return result as T
  }

  async initialize() {
    try {
      // Enable pgvector extension first
      await this.pg.query(`CREATE EXTENSION IF NOT EXISTS vector`)

      this.embeddings =
        await EmbeddingManager.getInstance().getActiveEmbedding()
      const tableName = await this.getTableName()
      const { dimensions } = EmbeddingManager.getInstance().getActiveModelInfo()

      // Create table if not exists with snake_case column names
      await this.pg.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          scheme_uri TEXT NOT NULL,
          file_hash TEXT NOT NULL,
          start_line INTEGER NOT NULL,
          start_character INTEGER NOT NULL,
          end_line INTEGER NOT NULL,
          end_character INTEGER NOT NULL,
          embedding VECTOR(${dimensions})
        )
      `)

      // Use HNSW index instead of IVFFlat for better performance
      await this.pg.query(`
        CREATE INDEX IF NOT EXISTS ${tableName}_embedding_idx
        ON ${tableName} USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `)

      // Enable iterative scanning for better recall
      await this.pg.query(`SET hnsw.iterative_scan = strict_order`)

      logger.log('PGlite initialized successfully', { dbPath: this.dbPath })
    } catch (error) {
      logger.error('Failed to initialize PGlite:', error)
      throw error
    }
  }

  abstract getTableName(): Promise<string>

  async addRows(rows: T[]) {
    const tableName = await this.getTableName()
    for (const row of rows) {
      // Format embedding array to pgvector format by wrapping it in brackets
      const formattedEmbedding = JSON.stringify(row.embedding)

      await this.pg.query(
        `INSERT INTO ${tableName}
        (scheme_uri, file_hash, start_line, start_character, end_line, end_character, embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.schemeUri,
          row.fileHash,
          row.startLine,
          row.startCharacter,
          row.endLine,
          row.endCharacter,
          formattedEmbedding // Use formatted embedding string
        ]
      )
    }
  }

  async deleteFileFromIndex(schemeUri: string) {
    const tableName = await this.getTableName()
    await this.pg.query(`DELETE FROM ${tableName} WHERE scheme_uri = $1`, [
      schemeUri
    ])
  }

  async clearIndex() {
    const tableName = await this.getTableName()
    await this.pg.query(`DROP TABLE IF EXISTS ${tableName}`)
    await this.initialize() // Recreate the table
  }

  async searchSimilar(embedding: number[]): Promise<T[]> {
    const tableName = await this.getTableName()

    // Increase ef_search for better recall
    await this.pg.query(`SET hnsw.iterative_scan = strict_order`)
    await this.pg.query(`SET hnsw.ef_search = 100`)

    // Format query embedding
    const formattedEmbedding = JSON.stringify(embedding)

    const result = await this.pg.query<PgIndexRow>(
      `SELECT * FROM ${tableName}
       ORDER BY embedding <=> $1
       LIMIT 10`,
      [formattedEmbedding] // Use formatted embedding string
    )
    return result.rows.map(row => this.convertRowToCamelCase(row))
  }

  async getFileRows(schemeUri: string): Promise<T[]> {
    const tableName = await this.getTableName()
    const result = await this.pg.query<PgIndexRow>(
      `SELECT * FROM ${tableName} WHERE scheme_uri = $1`,
      [schemeUri]
    )
    return result.rows.map(row => this.convertRowToCamelCase(row))
  }

  async getAllRows(): Promise<T[]> {
    const tableName = await this.getTableName()
    const result = await this.pg.query<PgIndexRow>(`SELECT * FROM ${tableName}`)
    return result.rows.map(row => this.convertRowToCamelCase(row))
  }

  async getRowFileContent(row: IndexRow): Promise<string> {
    return await vfs.promises.readFile(row.schemeUri, 'utf-8')
  }

  async generateFileHash(fileSchemeUri: string): Promise<string> {
    return await getFileHash(fileSchemeUri)
  }

  async isValidRow(row: T): Promise<boolean> {
    const currentHash = await this.generateFileHash(row.schemeUri)
    return currentHash === row.fileHash
  }

  async searchSimilarRow(query: string): Promise<T[]> {
    const embedding = await this.embeddings.embedQuery(query)
    return this.searchSimilar(embedding)
  }

  async indexWorkspace() {
    this.progressReporter.reset()
    const fileSchemeUris = await this.getAllIndexedFileSchemeUris()
    this.totalFiles = fileSchemeUris.length
    this.progressReporter.setTotalItems(this.totalFiles)
    logger.verbose(`Indexing workspace with ${this.totalFiles} files`)
    await this.processFiles(fileSchemeUris)
  }

  async handleFileChange(schemeUri: string) {
    try {
      if (!(await this.isAvailableFile(schemeUri))) return

      await this.deleteFileFromIndex(schemeUri)
      this.processFiles([schemeUri])
    } catch (error) {
      logger.error(`Error handling file change for ${schemeUri}:`, error)
    }
  }

  async handleFileDelete(schemeUri: string) {
    try {
      await this.deleteFileFromIndex(schemeUri)
      logger.log(`Removed index for deleted file: ${schemeUri}`)
    } catch (error) {
      logger.error(`Error handling file deletion for ${schemeUri}:`, error)
    }
  }

  async reindexWorkspace(type: ReIndexType = 'full') {
    try {
      if (type === 'full') {
        await this.clearIndex()
        await this.indexWorkspace()
      } else {
        await this.diffReindex()
      }
      logger.log('Workspace reindexed successfully')
    } catch (error) {
      logger.error('Error reindexing workspace:', error)
      throw error
    }
  }

  async diffReindex() {
    this.progressReporter.reset()
    const fileSchemeUris = await this.getAllIndexedFileSchemeUris()
    const fileSchemeUrisNeedReindex: string[] = []

    const tasksPromises = fileSchemeUris.map(async schemeUri => {
      try {
        const currentHash = await this.generateFileHash(schemeUri)
        const existingRows = await this.getFileRows(schemeUri)

        if (
          existingRows.length === 0 ||
          existingRows[0]?.fileHash !== currentHash
        ) {
          await this.deleteFileFromIndex(schemeUri)
          fileSchemeUrisNeedReindex.push(schemeUri)
        }
      } catch (error) {
        logger.error(`Error processing file ${schemeUri}:`, error)
      }
    })

    await settledPromiseResults(tasksPromises)

    this.totalFiles = fileSchemeUrisNeedReindex.length
    this.progressReporter.setTotalItems(this.totalFiles)

    await this.processFiles(fileSchemeUrisNeedReindex)
  }

  private async processFiles(fileSchemeUris: string[]) {
    this.indexingQueue.push(...fileSchemeUris)

    if (this.isIndexing) return
    this.isIndexing = true

    while (this.indexingQueue.length > 0) {
      const filesToProcess = this.indexingQueue.splice(
        0,
        this.maxConcurrentFiles
      )
      const processingPromises = filesToProcess.map(filePath =>
        this.indexFile(filePath)
      )

      try {
        await settledPromiseResults(processingPromises)
      } catch (error) {
        logger.error(`Error indexing files:`, error)
      } finally {
        const processedCount = this.totalFiles - this.indexingQueue.length
        logger.verbose(
          `Processed ${processedCount} of ${this.totalFiles} files`
        )
        this.progressReporter.setProcessedItems(processedCount)
      }
    }
    this.isIndexing = false
    logger.verbose('Finished indexing all files')
  }

  abstract isAvailableFile(filePath: string): boolean | Promise<boolean>
  abstract indexFile(filePath: string): Promise<void>
  abstract getAllIndexedFileSchemeUris(): Promise<string[]>

  dispose() {
    this.progressReporter.dispose()
    this.embeddings.dispose?.()
  }

  setMaxConcurrentFiles(max: number) {
    this.maxConcurrentFiles = Math.max(1, Math.floor(max))
  }
}
