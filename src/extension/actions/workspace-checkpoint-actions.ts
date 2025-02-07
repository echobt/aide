import { WorkspaceCheckpointRegister } from '@extension/registers/workspace-checkpoint-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'

export class WorkspaceCheckpointActionsCollection extends ServerActionCollection {
  readonly categoryName = 'workspaceCheckpoint'

  private async getWorkspaceCheckpoint() {
    const workspaceCheckpoint = await this.registerManager.getRegister(
      WorkspaceCheckpointRegister
    )?.workspaceCheckpoint

    if (!workspaceCheckpoint)
      throw new Error('WorkspaceCheckpoint not initialized')

    return workspaceCheckpoint
  }

  async createCheckpoint(
    context: ActionContext<{ message: string }>
  ): Promise<string> {
    const { actionParams } = context
    const { message } = actionParams
    const workspaceCheckpoint = await this.getWorkspaceCheckpoint()

    return await workspaceCheckpoint.createCheckpoint(message)
  }

  async restoreCheckpoint(
    context: ActionContext<{ commitHash: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { commitHash } = actionParams
    const workspaceCheckpoint = await this.getWorkspaceCheckpoint()
    await workspaceCheckpoint.restoreCheckpoint(commitHash)
  }

  async cleanupMemory(context: ActionContext<{}>): Promise<void> {
    const workspaceCheckpoint = await this.getWorkspaceCheckpoint()
    await workspaceCheckpoint.cleanupMemory()
  }
}
