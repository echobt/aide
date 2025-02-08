import { BaseRegister } from '../base-register'
import {
  WebVMOrchestrator,
  type CreateWebVMOrchestratorOptions
} from './orchestrator'

export class WebVMRegister extends BaseRegister {
  idOrchestratorMap = new Map<string, WebVMOrchestrator>()

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async register(): Promise<void> {}

  getOrchestratorId(projectId: string, presetName: string): string {
    return `${projectId}:${presetName}`
  }

  async addOrchestrator(
    options: CreateWebVMOrchestratorOptions
  ): Promise<WebVMOrchestrator> {
    const orchestrator = await WebVMOrchestrator.create(options)
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

  dispose(): void {
    for (const orchestrator of this.idOrchestratorMap.values()) {
      orchestrator.dispose()
    }

    this.idOrchestratorMap.clear()
  }
}
