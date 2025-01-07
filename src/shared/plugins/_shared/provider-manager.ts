import { deepMergeProviders } from './deep-merge-providers'

export class ProviderUtils {
  static getValues = <T>(idProvidersMap: Record<string, () => T>): T[] =>
    Object.values(idProvidersMap).map(provider => provider?.())

  static getValuesMap = <T>(
    idProvidersMap: Record<string, () => T>
  ): Record<string, T> =>
    Object.fromEntries(
      Object.entries(idProvidersMap).map(([id, provider]) => [id, provider?.()])
    )

  static mergeAll = <T>(
    idProvidersMap: Record<string, () => T>
  ): T | undefined => {
    const allValues = ProviderUtils.getValues(idProvidersMap)
    return deepMergeProviders(allValues)
  }
}

export class ProviderManager<Id extends string, T> {
  protected idProvidersMap = {} as Record<Id, () => T>

  register(pluginId: Id, provider: () => T): void {
    this.idProvidersMap[pluginId] = provider
  }

  unregister(pluginId: Id): void {
    delete this.idProvidersMap[pluginId]
  }

  getValues(): T[] {
    return ProviderUtils.getValues<T>(this.idProvidersMap)
  }

  getIdProviderMap(): Record<Id, T> {
    return Object.fromEntries(
      Object.entries<() => T>(this.idProvidersMap).map(([id, provider]) => [
        id,
        provider?.()
      ])
    ) as Record<Id, T>
  }

  mergeAll(): T | undefined {
    return ProviderUtils.mergeAll<T>(this.idProvidersMap)
  }
}
