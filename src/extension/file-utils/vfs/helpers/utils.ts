/* eslint-disable unused-imports/no-unused-vars */
import type { PathLike, PathOrFileDescriptor } from 'fs'
import * as fs from 'fs'
import type { IFS } from 'unionfs'
import * as vscode from 'vscode'

import type { UriScheme } from './types'

// Interface for scheme handlers
export interface SchemeHandler {
  scheme: UriScheme
  resolveFs(uri: string): OptimizedIFS | undefined

  resolveBaseUriSync(uri: string): string
  resolveBaseUriAsync(uri: string): Promise<string>

  resolveBasePathSync(uri: string): string
  resolveBasePathAsync(uri: string): Promise<string>

  resolveRelativePathSync(uri: string): string
  resolveRelativePathAsync(uri: string): Promise<string>

  resolveFullPathAsync(uri: string): Promise<string>
  resolveFullPathSync(uri: string): string
}

export type OptimizedIFS = IFS & Pick<typeof fs, 'rm'>
export type NodeFS = typeof fs

// Base class for scheme handlers
export abstract class BaseSchemeHandler implements SchemeHandler {
  scheme: UriScheme

  constructor(scheme: UriScheme) {
    this.scheme = scheme
  }

  /**
   * @param uri - The URI to resolve.
   * @returns The base URI.
   * @example
   * project://<project-name>/<relative-path> -> project://<project-name>
   */
  abstract resolveBaseUriSync(uri: string): string

  /**
   * @param uri - The URI to resolve.
   * @returns The base URI.
   * @example
   * project://<project-name>/<relative-path> -> project://<project-name>
   */
  abstract resolveBaseUriAsync(uri: string): Promise<string>

  /**
   * @param uri - The URI to resolve.
   * @returns The base path.
   * @example
   * project://<project-name>/<relative-path> -> /projects/<project-name>
   */
  abstract resolveBasePathSync(uri: string): string

  /**
   * @param uri - The URI to resolve.
   * @returns The base path.
   * @example
   * project://<project-name>/<relative-path> -> /projects/<project-name>
   */
  abstract resolveBasePathAsync(uri: string): Promise<string>

  /**
   * @param uri - The URI to resolve.
   * @returns The relative path.
   * @example
   * project://<project-name>/<relative-path> -> <relative-path>
   */
  abstract resolveRelativePathSync(uri: string): string

  /**
   * @param uri - The URI to resolve.
   * @returns The relative path.
   * @example
   * project://<project-name>/<relative-path> -> <relative-path>
   */
  abstract resolveRelativePathAsync(uri: string): Promise<string>

  /**
   * @param uri - The URI to resolve.
   * @returns The relative path.
   * @example
   * project://<project-name>/<relative-path> -> <relative-path>
   */
  abstract resolveFullPathAsync(uri: string): Promise<string>

  /**
   * @param uri - The URI to resolve.
   * @returns The full path.
   * @example
   * project://<project-name>/<relative-path> -> /projects/<project-name>/<relative-path>
   */
  abstract resolveFullPathSync(uri: string): string

  /**
   * @param uri - The URI to resolve.
   * @returns The fs.
   */
  resolveFs(uri: string): OptimizedIFS | undefined {
    return undefined
  }

  /**
   * @param props - The properties to create the scheme URI.
   * @returns The scheme URI.
   */
  abstract createSchemeUri(props: Record<string, any>): string
}

export type GetIFSMethod<T extends keyof OptimizedIFS> =
  OptimizedIFS[T] extends (...args: infer A) => infer B
    ? (...args: A) => B
    : never

export const createIFSMethod = <T extends keyof OptimizedIFS>(
  fn: GetIFSMethod<T>
): OptimizedIFS[T] => {
  const _fn = fn as any
  _fn.__promisify__ = (...args: Parameters<GetIFSMethod<T>>) => _fn(...args)
  return _fn as OptimizedIFS[T]
}

export const getPromisifyFn = <T extends keyof OptimizedIFS>(
  fn: OptimizedIFS[T]
): OptimizedIFS[T] extends { __promisify__: (...args: any[]) => any }
  ? OptimizedIFS[T]['__promisify__']
  : undefined => ('__promisify__' in fn ? fn.__promisify__ : fn) as any

export const getUri = (
  path: PathLike | PathOrFileDescriptor | string
): vscode.Uri =>
  typeof path === 'string'
    ? vscode.Uri.file(path)
    : vscode.Uri.file(path.toString())
