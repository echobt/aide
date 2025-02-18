import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import {
  settingKeyItemConfigMap,
  settingsConfig,
  SettingsEntity,
  type EntitySaveType,
  type GlobalSettingKey,
  type SettingKey,
  type Settings,
  type SettingValue,
  type WorkspaceSettingKey
} from '@shared/entities'

import { BaseDB } from './_base'

class SettingsDB<
  AllowSettingKey extends SettingKey = SettingKey
> extends BaseDB<Settings> {
  static readonly schemaVersion = 1

  private saveType: EntitySaveType

  constructor(saveType: EntitySaveType) {
    super()
    this.saveType = saveType
  }

  async init() {
    const filePath =
      this.saveType === 'global'
        ? path.join(
            await aidePaths.getGlobalLowdbPath(),
            'global-settings.json'
          )
        : path.join(
            await aidePaths.getWorkspaceLowdbPath(),
            'workspace-settings.json'
          )

    await this.initConfig({
      filePath,
      currentVersion: SettingsDB.schemaVersion
    })
  }

  getDefaults(): Partial<Settings> {
    return new SettingsEntity().entity
  }

  async setSetting<K extends AllowSettingKey>(
    key: K,
    value: SettingValue<K>
  ): Promise<Settings> {
    const existingSettings = await this.getAll()
    const existing = existingSettings.find(s => s.key === key)

    if (existing) {
      return this.update(existing.id, {
        value,
        updatedAt: Date.now()
      }) as Promise<Settings>
    }

    const setting = new SettingsEntity({
      key,
      value,
      updatedAt: Date.now()
    }).entity

    return this.add(setting)
  }

  async getSetting<K extends AllowSettingKey>(
    key: K
  ): Promise<SettingValue<K>> {
    const settings = await this.getAll()
    const setting = settings.find(s => s.key === key)
    return setting
      ? (setting.value as SettingValue<K>)
      : settingKeyItemConfigMap[key].renderOptions.defaultValue
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const settings = await this.getAll()
    const defaults = Object.entries(settingsConfig).reduce(
      (acc, [key, config]) => {
        acc[key] = config.defaultValue
        return acc
      },
      {} as Record<string, any>
    )

    const userSettings = settings.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value
        return acc
      },
      {} as Record<string, any>
    )

    return { ...defaults, ...userSettings }
  }

  getSettingConfig<K extends AllowSettingKey>(key: K) {
    return settingKeyItemConfigMap[key]
  }

  getAllSettingConfigs() {
    return settingsConfig
  }
}

export const globalSettingsDB = new SettingsDB<GlobalSettingKey>('global')
export const workspaceSettingsDB = new SettingsDB<WorkspaceSettingKey>(
  'workspace'
)
