import type { ActionExecutor } from './types'

export abstract class ClientActionCollection {
  abstract readonly categoryName: string;

  [actionName: string]:
    | ActionExecutor<Record<string, any>, any>
    | string
    | unknown
    | undefined
}

export type ClientActionCollectionClass = new (
  ...args: ConstructorParameters<typeof ClientActionCollection>
) => ClientActionCollection
