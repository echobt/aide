/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { gitUtils } from '@extension/file-utils/git'
import {
  globalSettingsDB,
  workspaceSettingsDB
} from '@extension/lowdb/settings-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { settingKeyItemConfigMap } from '@shared/entities'
import type {
  GlobalSettingKey,
  SettingKey,
  SettingsSaveType,
  SettingValue,
  WorkspaceSettingKey
} from '@shared/entities'

export class SettingsActionsCollection extends ServerActionCollection {
  readonly categoryName = 'settings'

  async getGlobalSetting<K extends GlobalSettingKey>(
    context: ActionContext<{ key: K }>
  ): Promise<SettingValue<K> | null> {
    const { actionParams } = context
    const { key } = actionParams

    return await globalSettingsDB.getSetting(key)
  }

  async setGlobalSetting<K extends GlobalSettingKey>(
    context: ActionContext<{ key: K; value: SettingValue<K> }>
  ): Promise<void> {
    const { actionParams } = context
    const { key, value } = actionParams

    await this.handleBeforeSettingChange(key, value, 'global')
    await globalSettingsDB.setSetting(key, value)
    await this.handleAfterSettingChange(key, value, 'global')
  }

  async getAllGlobalSettings(
    context: ActionContext<{}>
  ): Promise<Record<string, any>> {
    return await globalSettingsDB.getAllSettings()
  }

  async getWorkspaceSetting<K extends WorkspaceSettingKey>(
    context: ActionContext<{ key: K }>
  ): Promise<SettingValue<K> | null> {
    const { actionParams } = context
    const { key } = actionParams

    return await workspaceSettingsDB.getSetting(key)
  }

  async setWorkspaceSetting<K extends WorkspaceSettingKey>(
    context: ActionContext<{ key: K; value: SettingValue<K> }>
  ): Promise<void> {
    const { actionParams } = context
    const { key, value } = actionParams

    await this.handleBeforeSettingChange(key, value, 'workspace')
    await workspaceSettingsDB.setSetting(key, value)
    await this.handleAfterSettingChange(key, value, 'workspace')
  }

  async getAllWorkspaceSettings(
    context: ActionContext<{}>
  ): Promise<Record<string, any>> {
    return await workspaceSettingsDB.getAllSettings()
  }

  async setGlobalSettings(
    context: ActionContext<{
      settings: Partial<
        Record<GlobalSettingKey, SettingValue<GlobalSettingKey>>
      >
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { settings } = actionParams

    for (const [_key, value] of Object.entries(settings)) {
      const key = _key as GlobalSettingKey
      await this.handleBeforeSettingChange(key, value, 'global')
      await globalSettingsDB.setSetting(key, value)
      await this.handleAfterSettingChange(key, value, 'global')
    }
  }

  async setWorkspaceSettings(
    context: ActionContext<{
      settings: Partial<
        Record<WorkspaceSettingKey, SettingValue<WorkspaceSettingKey>>
      >
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { settings } = actionParams

    for (const [_key, value] of Object.entries(settings)) {
      const key = _key as WorkspaceSettingKey
      await this.handleBeforeSettingChange(key, value, 'workspace')
      await workspaceSettingsDB.setSetting(key, value)
      await this.handleAfterSettingChange(key, value, 'workspace')
    }
  }

  private async getSaveType(key: SettingKey): Promise<SettingsSaveType> {
    return settingKeyItemConfigMap[key].saveType
  }

  async getSetting(
    context: ActionContext<{ key: SettingKey }>
  ): Promise<SettingValue<SettingKey> | null> {
    const { actionParams } = context
    const { key } = actionParams
    const saveType = await this.getSaveType(key)

    return saveType === 'global'
      ? await globalSettingsDB.getSetting(key as GlobalSettingKey)
      : await workspaceSettingsDB.getSetting(key as WorkspaceSettingKey)
  }

  async setSettings(
    context: ActionContext<{
      settings: Partial<Record<SettingKey, SettingValue<SettingKey>>>
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { settings } = actionParams

    for (const [key, value] of Object.entries(settings)) {
      const saveType = await this.getSaveType(key as SettingKey)

      await this.handleBeforeSettingChange(key as SettingKey, value, saveType)
      if (saveType === 'global') {
        await globalSettingsDB.setSetting(key as GlobalSettingKey, value)
      } else {
        await workspaceSettingsDB.setSetting(key as WorkspaceSettingKey, value)
      }
      await this.handleAfterSettingChange(key as SettingKey, value, saveType)
    }
  }

  async getMergedSettings(
    context: ActionContext<{}>
  ): Promise<Record<string, any>> {
    const globalSettings = await globalSettingsDB.getAllSettings()
    const workspaceSettings = await workspaceSettingsDB.getAllSettings()

    return {
      ...globalSettings,
      ...workspaceSettings // Workspace settings take precedence
    }
  }

  private async handleBeforeSettingChange(
    key: SettingKey,
    value: SettingValue<SettingKey>,
    saveType: SettingsSaveType
  ): Promise<void> {
    if (key === 'gitExecutablePath' && value) {
      // validate git path
      const isValid = await gitUtils.validateGitPath(value as string)
      if (!isValid) throw new Error('Invalid git executable path')
      gitUtils.clearCache()
    }
  }

  private async handleAfterSettingChange(
    key: SettingKey,
    value: SettingValue<SettingKey>,
    saveType: SettingsSaveType
  ): Promise<void> {}
}
