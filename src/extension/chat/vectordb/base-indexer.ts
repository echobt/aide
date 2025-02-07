import { EmbeddingManager } from '@extension/ai/embeddings/embedding-manager'
import type { BaseEmbeddings } from '@extension/ai/embeddings/types'
import { getFileHash } from '@extension/file-utils/get-file-hash'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import {
  Field,
  FixedSizeList,
  Float32,
  Int32,
  Schema,
  Utf8
} from 'apache-arrow'
import { connect, Table, type Connection } from 'vectordb'

import { ProgressReporter } from '../utils/progress-reporter'

export type ReIndexType = 'full' | 'diff'

export interface IndexRow {
  schemeUri: string
  fileHash: string
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
  embedding: number[]
}

export const createBaseTableSchemaFields = (dimensions: number) => [
  new Field('schemeUri', new Utf8()),
  new Field('fileHash', new Utf8()),
  new Field('startLine', new Int32()),
  new Field('startCharacter', new Int32()),
  new Field('endLine', new Int32()),
  new Field('endCharacter', new Int32()),
  new Field(
    'embedding',
    new FixedSizeList(dimensions, new Field('emb', new Float32()))
  )
]

export abstract class BaseIndexer<T extends IndexRow> {
  protected _cacheTable?: Table<number[]>

  protected lanceDb!: Connection

  protected embeddings!: BaseEmbeddings

  protected isIndexing: boolean = false

  protected indexingQueue: string[] = []

  protected totalFiles: number = 0

  protected maxConcurrentFiles: number = 5

  progressReporter = new ProgressReporter()

  constructor(protected dbPath: string) {}

  async initialize() {
    try {
      this.lanceDb = await connect(this.dbPath)
      this.embeddings =
        await EmbeddingManager.getInstance().getActiveEmbedding()
      logger.log('LanceDB initialized successfully', { dbPath: this.dbPath })
    } catch (error) {
      logger.error('Failed to initialize LanceDB:', error)
      throw error
    }
  }

  abstract getTableName(): Promise<string>

  abstract getTableSchema(dimensions: number): Schema

  async getOrCreateTable(): Promise<Table<number[]>> {
    if (this._cacheTable) return this._cacheTable

    const tableName = await this.getTableName()
    const { dimensions } = EmbeddingManager.getInstance().getActiveModelInfo()

    try {
      const tables = await this.lanceDb.tableNames()
      const schema = this.getTableSchema(dimensions)

      if (tables.includes(tableName)) {
        this._cacheTable = await this.lanceDb.openTable(tableName)
        return this._cacheTable
      }

      // TODO: Fix the issue
      // if (tables.includes(tableName)) {
      //   const table = await this.lanceDb.openTable(tableName)
      //   const oldSchema = await table.schema
      //   if (this.isSchemaEqual(oldSchema, schema)) return table
      //   // drop table
      //   await this.lanceDb.dropTable(tableName)
      // }

      this._cacheTable = await this.lanceDb.createTable({
        name: tableName,
        schema
      })

      return this._cacheTable
    } catch (error) {
      logger.error('Error getting or creating table:', error)
      throw error
    }
  }

  private isSchemaEqual(oldSchema: Schema, newSchema: Schema) {
    return (
      oldSchema.fields.every(field =>
        newSchema.fields.some(
          f => f.name === field.name && f.type === field.type
        )
      ) &&
      oldSchema.fields.length === newSchema.fields.length &&
      oldSchema.metadataVersion === newSchema.metadataVersion
    )
  }

  async addRows(rows: T[]) {
    const table = await this.getOrCreateTable()
    await table.add(rows as any)
  }

  async deleteFileFromIndex(schemeUri: string) {
    const table = await this.getOrCreateTable()
    await table.delete(`\`schemeUri\` = '${schemeUri}'`)
  }

  async clearIndex() {
    const tableName = await this.getTableName()
    try {
      const tables = await this.lanceDb.tableNames()
      if (tables.includes(tableName)) {
        await this.lanceDb.dropTable(tableName)
        this._cacheTable = undefined
      }
    } catch (error) {
      logger.error('Error dropping table:', error)
      throw error
    }
  }

  async searchSimilar(embedding: number[]): Promise<T[]> {
    const table = await this.getOrCreateTable()
    return await table.search(embedding).limit(10).execute<T>()
  }

  async getFileRows(schemeUri: string): Promise<T[]> {
    const table = await this.getOrCreateTable()
    return await table.filter(`\`schemeUri\` = '${schemeUri}'`).execute<T>()
  }

  async getAllRows(): Promise<T[]> {
    const table = await this.getOrCreateTable()
    return await table.filter('true').execute<T>()
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
      if (!(await this.isAvailableFile(schemeUri))) return

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

  async deleteWorkspaceIndex() {
    await this.clearIndex()
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
    this.maxConcurrentFiles = Math.max(1, Math.floor(max)) // 确保最小值为1，并且是整数
  }
}
