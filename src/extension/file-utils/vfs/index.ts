/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { PathLike } from 'fs'
import path from 'path'
import { t } from '@extension/i18n'
import { logger } from '@extension/logger'
import { getWorkspaceFolder } from '@extension/utils'
import { hasOwnProperty, toUnixPath } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import JSONC from 'comment-json'
import { Union, type IUnionFs } from 'unionfs'
import * as vscode from 'vscode'

import { ensureDir } from './helpers/fs-extra/ensure-dir'
import { ensureFile } from './helpers/fs-extra/ensure-file'
import { UriScheme } from './helpers/types'
import { type OptimizedIFS, type SchemeHandler } from './helpers/utils'
import { docSchemeHandler } from './schemes/doc-scheme'
import { gitProjectSchemeHandler } from './schemes/git-project-scheme'
import { projectSchemeHandler } from './schemes/project-scheme'
import { webvmSchemeHandler } from './schemes/webvm-scheme'
import { workspaceSchemeHandler } from './schemes/workspace-scheme'
import { VsCodeFS } from './vscode-fs'

// Virtual File System class
export class VirtualFileSystem implements OptimizedIFS {
  private union: IUnionFs & OptimizedIFS

  private schemeHandlerMap = new Map<UriScheme, SchemeHandler>()

  promises!: OptimizedIFS['promises']

  constructor(initFsArray: OptimizedIFS[]) {
    this.union = new Union() as IUnionFs & OptimizedIFS
    initFsArray.forEach(fs => this.union.use(fs))

    if (!this.union.rm) {
      // @ts-expect-error
      this.union.rm = this.union.promises.rm
      this.union.rm.__promisify__ = this.union.promises.rm
    }

    const handlers: SchemeHandler[] = [
      projectSchemeHandler,
      gitProjectSchemeHandler,
      workspaceSchemeHandler,
      docSchemeHandler,
      webvmSchemeHandler
    ]

    handlers.forEach(handler => {
      this.schemeHandlerMap.set(handler.scheme, handler)
    })

    // Initialize all methods
    this.initFsSyncMethods()
    this.initFsAsyncMethods()
    this.initFsPromisesMethods()
  }

  private getSchemeHandler = (
    path: string | PathLike,
    throwErrorIfNotFound = false
  ): SchemeHandler | undefined => {
    const stringPath = typeof path === 'string' ? path : path.toString()
    const { scheme } = SchemeUriHelper.parse(stringPath, false)

    if (scheme && !this.schemeHandlerMap.has(scheme as UriScheme)) {
      if (throwErrorIfNotFound) {
        throw new Error(`No handler found for URI: ${stringPath}`)
      }
      return undefined
    }

    return scheme ? this.schemeHandlerMap.get(scheme as UriScheme) : undefined
  }

  private getFs = (originalPath: string | PathLike): OptimizedIFS => {
    const path = String(originalPath)
    const handler = this.getSchemeHandler(path)
    if (handler) return handler.resolveFs(path) || this.union
    return this.union
  }

  // Helper methods
  private resolveFullPathSync = (originalPath: string | PathLike): PathLike => {
    const path = String(originalPath)
    const handler = this.getSchemeHandler(path, true)
    if (handler) return handler.resolveFullPathSync(path)
    return originalPath
  }

  private resolveFullPathAsync = async (
    originalPath: string | PathLike
  ): Promise<PathLike> => {
    const path = String(originalPath)
    const handler = this.getSchemeHandler(path, true)
    if (handler) return handler.resolveFullPathAsync(path)
    return originalPath
  }

  resolveFullPathProAsync = async <T extends boolean>(
    originalPath: string | PathLike,
    returnNullIfNotExists: T
  ): Promise<T extends true ? string | null : string> => {
    let absolutePath: string = String(
      await this.resolveFullPathAsync(originalPath)
    )
    try {
      const workspaceFolder = getWorkspaceFolder()
      if (!workspaceFolder) throw new Error(t('error.noWorkspace'))

      absolutePath =
        absolutePath && path.isAbsolute(absolutePath)
          ? absolutePath
          : path.join(workspaceFolder.uri.fsPath, absolutePath)
      const isExists = await this.isExists(absolutePath)

      if (returnNullIfNotExists && !isExists) return null as any

      return toUnixPath(absolutePath)
    } catch {
      if (returnNullIfNotExists) return null as any
      return toUnixPath(absolutePath)
    }
  }

  resolveRelativePathProSync = (originalPath: string): string => {
    try {
      const handler = this.getSchemeHandler(originalPath, false)
      if (handler) return handler.resolveRelativePathSync(originalPath)

      const workspaceFolder = getWorkspaceFolder()
      if (!workspaceFolder) throw new Error(t('error.noWorkspace'))

      const absolutePath =
        originalPath && path.isAbsolute(originalPath)
          ? originalPath
          : path.join(workspaceFolder.uri.fsPath, originalPath)

      const relativePath = path.relative(
        workspaceFolder.uri.fsPath,
        absolutePath
      )

      return toUnixPath(relativePath || './')
    } catch (error) {
      logger.error(
        `Error resolving scheme relative file path: ${originalPath}`,
        error
      )
      return toUnixPath(originalPath)
    }
  }

  resolveBasePathProAsync = async (
    originalPath: string | PathLike
  ): Promise<string> => {
    const defaultPath = toUnixPath(getWorkspaceFolder().uri.fsPath)
    try {
      const handler = this.getSchemeHandler(originalPath, true)
      if (handler) return handler.resolveBasePathAsync(String(originalPath))
      return defaultPath
    } catch (error) {
      logger.error(`Error resolving base path: ${originalPath}`, error)
      return defaultPath
    }
  }

  resolveBaseUriProSync = (uri: string): string => {
    const handler = this.getSchemeHandler(uri, true)
    if (handler) return handler.resolveBaseUriSync(uri)
    throw new Error(`No handler found for URI: ${uri}`)
  }

  /**
   * Warning: This method is only for AI prompt
   */
  resolvePathForAIPrompt = (uri: string): string => {
    if (!this.isSchemeUri(uri)) return uri

    const { scheme } = SchemeUriHelper.parse(uri, false)

    if (scheme === UriScheme.Workspace) {
      // if workspace scheme, return relative path
      return workspaceSchemeHandler.resolveRelativePathSync(uri)
    }

    return uri
  }

  isSchemeUri = (uri: string): boolean => {
    const handler = this.getSchemeHandler(uri, false)
    return !!handler
  }

  toSchemeUri = async (
    uri: string | PathLike | vscode.Uri
  ): Promise<string> => {
    if (uri instanceof vscode.Uri) {
      return workspaceSchemeHandler.createSchemeUri({
        fullPath: uri.fsPath
      })
    }

    return await this.fixSchemeUri(String(uri))
  }

  fixSchemeUri = async (uri: string): Promise<string> => {
    if (!this.isSchemeUri(uri)) {
      const fullPath = await this.resolveFullPathProAsync(uri, false)
      return workspaceSchemeHandler.createSchemeUri({
        fullPath
      })
    }
    return toUnixPath(uri)
  }

  writeJsonFile = async (filePath: string, data: any): Promise<void> => {
    const resolvedPath = String(await this.resolveFullPathAsync(filePath))

    await this.promises.writeFile(resolvedPath, JSON.stringify(data, null, 2))
  }

  readJsonFile = async <T extends object>(filePath: string): Promise<T> => {
    const resolvedPath = String(await this.resolveFullPathAsync(filePath))

    return JSONC.parse(await this.promises.readFile(resolvedPath, 'utf-8')) as T
  }

  ensureFile = async (filePath: string): Promise<void> => {
    const fs = this.getFs(filePath)
    const resolvedPath = String(await this.resolveFullPathAsync(filePath))

    await ensureFile(fs, resolvedPath)
  }

  ensureDir = async (dirPath: string): Promise<void> => {
    const fs = this.getFs(dirPath)
    const resolvedPath = String(await this.resolveFullPathAsync(dirPath))

    await ensureDir(fs, resolvedPath)
  }

  readFilePro = async (
    path: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> => {
    const resolvedPath = String(await this.resolveFullPathAsync(path))
    const documents = vscode.workspace.textDocuments
    const document = documents.find(doc => doc.uri.fsPath === resolvedPath)
    const openDocumentContent = document?.getText()

    if (openDocumentContent !== undefined) {
      return openDocumentContent
    }

    return await this.promises.readFile(resolvedPath, {
      encoding
    })
  }

  isExists = async (path: string): Promise<boolean> => {
    const resolvedPath = await this.resolveFullPathAsync(path)
    try {
      await this.promises.access(resolvedPath)
      return true
    } catch (error) {
      return false
    }
  }

  private initFsSyncMethods = () => {
    const methods: (keyof OptimizedIFS)[] = [
      'accessSync',
      'appendFileSync',
      'chmodSync',
      'chownSync',
      'closeSync',
      'existsSync',
      'fchmodSync',
      'fchownSync',
      'fstatSync',
      'fsyncSync',
      'ftruncateSync',
      'futimesSync',
      'lchmodSync',
      'lchownSync',
      'linkSync',
      'lstatSync',
      'mkdirSync',
      'openSync',
      'readdirSync',
      'readFileSync',
      'readlinkSync',
      'readSync',
      'realpathSync',
      'renameSync',
      'rmdirSync',
      'statSync',
      'symlinkSync',
      'truncateSync',
      'unlinkSync',
      'utimesSync',
      'writeFileSync',
      'writeSync',

      'createReadStream',
      'createWriteStream',
      'watch',
      'watchFile',
      'unwatchFile'
    ]

    for (const method of methods) {
      if (typeof this.union[method] === 'function') {
        // @ts-expect-error - Dynamic method assignment
        this[method] = (...args: any[]) => {
          const [path, ...rest] = args
          const resolvedPath = this.resolveFullPathSync(path)
          return (this.getFs(path)[method] as Function)(resolvedPath, ...rest)
        }
      }
    }
  }

  private initFsAsyncMethods = () => {
    const methods: (keyof OptimizedIFS)[] = [
      'access',
      'appendFile',
      'chmod',
      'chown',
      'close',
      'exists',
      'fchmod',
      'fchown',
      'fstat',
      'fsync',
      'ftruncate',
      'futimes',
      'lchmod',
      'lchown',
      'link',
      'lstat',
      'mkdir',
      'open',
      'readdir',
      'readFile',
      'readlink',
      'read',
      'realpath',
      'rename',
      'rmdir',
      'rm',
      'stat',
      'symlink',
      'truncate',
      'unlink',
      'utimes',
      'writeFile',
      'write'
    ]

    for (const method of methods) {
      if (typeof this.union[method] === 'function') {
        // @ts-expect-error - Dynamic method assignment
        this[method] = async (...args: any[]) => {
          const [path, ...rest] = args
          const resolvedPath = await this.resolveFullPathAsync(path)
          return (this.getFs(path)[method] as Function)(resolvedPath, ...rest)
        }

        // Add __promisify__ for async methods
        // @ts-expect-error - Dynamic method assignment
        this[method].__promisify__ = async (...args: any[]) => {
          const [path, ...rest] = args
          const resolvedPath = await this.resolveFullPathAsync(path)

          if (hasOwnProperty(this.getFs(path)[method], '__promisify__')) {
            return (this.getFs(path)[method] as any).__promisify__(
              resolvedPath,
              ...rest
            )
          }
          return (this.getFs(path)[method] as any)(resolvedPath, ...rest)
        }
      }
    }

    // Special handling for methods with multiple paths
    const multiPathMethods: (keyof OptimizedIFS)[] = [
      'rename',
      'link',
      'symlink'
    ]
    for (const method of multiPathMethods) {
      if (typeof this.union[method] === 'function') {
        // @ts-expect-error - Dynamic method assignment
        this[method] = async (...args: any[]) => {
          const [src, dest, ...rest] = args
          const resolvedSrc = await this.resolveFullPathAsync(src)
          const resolvedDest = await this.resolveFullPathAsync(dest)
          return (this.getFs(src)[method] as Function)(
            resolvedSrc,
            resolvedDest,
            ...rest
          )
        }

        // Add __promisify__ for multi-path async methods
        // @ts-expect-error - Dynamic method assignment
        this[method].__promisify__ = async (...args: any[]) => {
          const [src, dest, ...rest] = args
          const resolvedSrc = await this.resolveFullPathAsync(src)
          const resolvedDest = await this.resolveFullPathAsync(dest)

          if (hasOwnProperty(this.getFs(src)[method], '__promisify__')) {
            return (this.getFs(src)[method] as any).__promisify__(
              resolvedSrc,
              resolvedDest,
              ...rest
            )
          }
          return (this.getFs(src)[method] as any)(
            resolvedSrc,
            resolvedDest,
            ...rest
          )
        }
      }
    }

    // Add stream classes
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    Object.defineProperty(this, 'WriteStream', {
      get() {
        return that.union.WriteStream
      }
    })

    Object.defineProperty(this, 'ReadStream', {
      get() {
        return that.union.ReadStream
      }
    })
  }

  private initFsPromisesMethods = () => {
    const methods: (keyof OptimizedIFS['promises'])[] = [
      'access',
      'appendFile',
      'copyFile',
      'cp',
      'link',
      'lstat',
      'mkdir',
      'mkdtemp',
      'open',
      'opendir',
      'readdir',
      'readFile',
      'readlink',
      'realpath',
      'rename',
      'rm',
      'rmdir',
      'stat',
      'truncate',
      'unlink',
      'watch',
      'writeFile'
    ]

    // Initialize promises object if not already initialized
    if (!this.promises) {
      this.promises = {} as OptimizedIFS['promises']
    }

    // Add methods to promises object
    for (const method of methods) {
      if (typeof this.union.promises?.[method] === 'function') {
        ;(this.promises as any)[method] = async (...args: any[]) => {
          const [path, ...rest] = args
          const resolvedPath = await this.resolveFullPathAsync(path)
          return (this.getFs(path).promises[method] as any)(
            resolvedPath,
            ...rest
          )
        }
      }
    }

    // Special handling for methods with multiple paths
    const multiPathMethods = ['rename', 'link', 'symlink'] as const
    for (const method of multiPathMethods) {
      if (typeof this.union.promises?.[method] === 'function') {
        this.promises[method] = async (...args: any[]) => {
          const [src, dest, ...rest] = args
          const resolvedSrc = await this.resolveFullPathAsync(src)
          const resolvedDest = await this.resolveFullPathAsync(dest)
          return this.getFs(src).promises[method](
            resolvedSrc,
            resolvedDest,
            ...rest
          )
        }
      }
    }
  }

  // File access methods
  access!: OptimizedIFS['access']

  accessSync!: OptimizedIFS['accessSync']

  appendFile!: OptimizedIFS['appendFile']

  appendFileSync!: OptimizedIFS['appendFileSync']

  chmod!: OptimizedIFS['chmod']

  chmodSync!: OptimizedIFS['chmodSync']

  chown!: OptimizedIFS['chown']

  chownSync!: OptimizedIFS['chownSync']

  close!: OptimizedIFS['close']

  closeSync!: OptimizedIFS['closeSync']

  createReadStream!: OptimizedIFS['createReadStream']

  createWriteStream!: OptimizedIFS['createWriteStream']

  exists!: OptimizedIFS['exists']

  existsSync!: OptimizedIFS['existsSync']

  fchmod!: OptimizedIFS['fchmod']

  fchmodSync!: OptimizedIFS['fchmodSync']

  fchown!: OptimizedIFS['fchown']

  fchownSync!: OptimizedIFS['fchownSync']

  fstat!: OptimizedIFS['fstat']

  fstatSync!: OptimizedIFS['fstatSync']

  fsync!: OptimizedIFS['fsync']

  fsyncSync!: OptimizedIFS['fsyncSync']

  ftruncate!: OptimizedIFS['ftruncate']

  ftruncateSync!: OptimizedIFS['ftruncateSync']

  futimes!: OptimizedIFS['futimes']

  futimesSync!: OptimizedIFS['futimesSync']

  lchmod!: OptimizedIFS['lchmod']

  lchmodSync!: OptimizedIFS['lchmodSync']

  lchown!: OptimizedIFS['lchown']

  lchownSync!: OptimizedIFS['lchownSync']

  link!: OptimizedIFS['link']

  linkSync!: OptimizedIFS['linkSync']

  lstat!: OptimizedIFS['lstat']

  lstatSync!: OptimizedIFS['lstatSync']

  mkdir!: OptimizedIFS['mkdir']

  mkdirSync!: OptimizedIFS['mkdirSync']

  open!: OptimizedIFS['open']

  openSync!: OptimizedIFS['openSync']

  read!: OptimizedIFS['read']

  readdir!: OptimizedIFS['readdir']

  readdirSync!: OptimizedIFS['readdirSync']

  readFile!: OptimizedIFS['readFile']

  readFileSync!: OptimizedIFS['readFileSync']

  readlink!: OptimizedIFS['readlink']

  readlinkSync!: OptimizedIFS['readlinkSync']

  readSync!: OptimizedIFS['readSync']

  realpath!: OptimizedIFS['realpath']

  realpathSync!: OptimizedIFS['realpathSync']

  rename!: OptimizedIFS['rename']

  renameSync!: OptimizedIFS['renameSync']

  rmdir!: OptimizedIFS['rmdir']

  rmdirSync!: OptimizedIFS['rmdirSync']

  rm!: OptimizedIFS['rm']

  stat!: OptimizedIFS['stat']

  statSync!: OptimizedIFS['statSync']

  symlink!: OptimizedIFS['symlink']

  symlinkSync!: OptimizedIFS['symlinkSync']

  truncate!: OptimizedIFS['truncate']

  truncateSync!: OptimizedIFS['truncateSync']

  unlink!: OptimizedIFS['unlink']

  unlinkSync!: OptimizedIFS['unlinkSync']

  unwatchFile!: OptimizedIFS['unwatchFile']

  utimes!: OptimizedIFS['utimes']

  utimesSync!: OptimizedIFS['utimesSync']

  watch!: OptimizedIFS['watch']

  watchFile!: OptimizedIFS['watchFile']

  write!: OptimizedIFS['write']

  writeFile!: OptimizedIFS['writeFile']

  writeFileSync!: OptimizedIFS['writeFileSync']

  writeSync!: OptimizedIFS['writeSync']

  // Stream classes
  WriteStream!: OptimizedIFS['WriteStream']

  ReadStream!: OptimizedIFS['ReadStream']
}

export const vfs = new VirtualFileSystem([new VsCodeFS()])
