import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'

import { BaseRegister } from '../base-register'
import {
  WebVMOrchestrator,
  type CreateWebVMOrchestratorOptions
} from './orchestrator'
import { presetClasses } from './presets'
import type { IFrameworkPreset, WebVMPresetInfo } from './types'

const MAX_ORCHESTRATORS = 6

export class WebVMRegister extends BaseRegister {
  idOrchestratorMap = new Map<string, WebVMOrchestrator>()

  presetNameMap = new Map<string, IFrameworkPreset>()

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async register(): Promise<void> {
    this.presetNameMap = new Map(
      presetClasses.map(PresetClass => {
        const preset = new PresetClass()
        return [preset.getPresetName(), preset] as const
      })
    )
  }

  getPreset(presetName: string): IFrameworkPreset | undefined {
    return this.presetNameMap.get(presetName)
  }

  getPresetInfo(presetName: string): WebVMPresetInfo {
    const preset = this.getPreset(presetName)

    if (!preset)
      throw new Error(
        t('extension.webvm.errors.presetNotFound', { presetName })
      )

    return {
      presetName: preset.getPresetName(),
      presetFrameworkName: preset.getAIPrompts().frameworkName,
      description: preset.getAIPrompts().stackInstructionsPrompt
    }
  }

  getPresetsInfo(): WebVMPresetInfo[] {
    return Array.from(this.presetNameMap.values()).map(preset =>
      this.getPresetInfo(preset.getPresetName())
    )
  }

  getOrchestratorId(projectId: string, presetName: string): string {
    return `${projectId}:${presetName}`
  }

  async createOrchestrator(
    options: Omit<CreateWebVMOrchestratorOptions, 'preset'> & {
      presetName: string
    }
  ): Promise<WebVMOrchestrator> {
    const preset = this.getPreset(options.presetName)
    if (!preset)
      throw new Error(
        t('extension.webvm.errors.presetNotFound', {
          presetName: options.presetName
        })
      )

    // remove the oldest orchestrator if the limit is reached
    if (this.idOrchestratorMap.size === MAX_ORCHESTRATORS) {
      // dispose the oldest orchestrator
      const id = Array.from(this.idOrchestratorMap.entries()).sort(
        (a, b) => a[1].getStatus().createdAt - b[1].getStatus().createdAt
      )?.[0]?.[0]

      if (id) {
        await this.removeOrchestrator(id)
      }
    }

    const orchestrator = await WebVMOrchestrator.create({
      ...options,
      preset
    })
    const id = this.getOrchestratorId(options.projectId, options.presetName)
    this.idOrchestratorMap.set(id, orchestrator)

    return orchestrator
  }

  async removeOrchestrator(id: string): Promise<void> {
    await this.idOrchestratorMap.get(id)?.dispose()
    this.idOrchestratorMap.delete(id)
  }

  getOrchestrator(
    projectId: string,
    presetName: string
  ): WebVMOrchestrator | undefined {
    const id = this.getOrchestratorId(projectId, presetName)
    return this.idOrchestratorMap.get(id)
  }

  async getOrCreateOrchestrator(
    projectId: string,
    presetName: string
  ): Promise<WebVMOrchestrator> {
    const orchestrator = this.getOrchestrator(projectId, presetName)
    return (
      orchestrator ?? (await this.createOrchestrator({ projectId, presetName }))
    )
  }

  async dispose(): Promise<void> {
    await settledPromiseResults(
      Array.from(this.idOrchestratorMap.values()).map(orchestrator =>
        orchestrator.dispose()
      )
    )

    this.presetNameMap.clear()
    this.idOrchestratorMap.clear()
  }
}
