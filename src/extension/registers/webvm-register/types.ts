/**
 * Core types for the AI-powered frontend project generator
 */

import type { MaybePromise } from '@shared/types/common'
import type { AliasOptions, UserConfig } from 'vite'

export type { Options as CdnConfig } from 'vite-plugin-cdn-import'
export type AliasConfig = AliasOptions
export type ViteConfig = UserConfig

// File structure returned by AI
export type WebVMFileItem = {
  relativePathOrSchemeUri: string
  content: string
}

export type WebVMFiles = WebVMFileItem[]

export interface WebVMStatus {
  isInitialized: boolean
  isPreviewServerRunning: boolean
  serverErrors?: string[]
  previewUrl: string
  createdAt: number
}

export interface IProjectConfig {
  name: string
  description?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Project Manager Interface
 * Handles file operations in WebVM
 */
export interface IProjectManager {
  getRootSchemeUri(): string
  getPreset(): IFrameworkPreset
  writeFile(relativePath: string, content: string): Promise<void>
  readFile(relativePath: string): Promise<string | null>
  deleteFile(relativePath: string): Promise<void>
  listFiles(): Promise<string[]>
  dispose(): MaybePromise<void>
  getConfig(): Promise<IProjectConfig>
  cleanProject(): Promise<void>
  updateConfig(config: Partial<IProjectConfig>): Promise<void>
}

/**
 * Preview Manager Interface
 * Handles Vite dev server in WebVM
 */
export interface IPreviewManager {
  startPreviewServer(): Promise<void>
  stopPreviewServer(): Promise<void>
  getIsPreviewServerRunning(): boolean
  getPreviewUrl(): string
  getServerErrors(): string[]
  dispose(): MaybePromise<void>
}

/**
 * Framework Preset Interface
 * Template for different tech stacks
 */
export interface IFrameworkPreset {
  getPresetName(): string
  getBaseProjectFiles(): WebVMFiles
  isKnownDeps(pathId: string): boolean
  processUnknownDepsLink(cdnLink: string, pathId: string): string
  getViteConfig(rootDir: string): ViteConfig
  getAIPrompts(): IAIPrompt
}

export interface IAIPrompt {
  frameworkName: string
  iconPkgName: string
  stackInstructionsPrompt: string
  stylingPrompt: string
  frameworkExamplesPrompt: string
  projectsExamplesPrompt: string
}

export interface WebVMPresetInfo {
  presetName: string
  presetFrameworkName: string
  description: string
}
