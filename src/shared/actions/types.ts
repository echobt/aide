import type { ServerActionCollections } from '@extension/actions'
import type { ValueUnion } from '@shared/types/common'
import type { ClientActionCollections } from '@webview/actions'

import type { ClientActionCollection } from './client-action-collection'
import type { ServerActionCollection } from './server-action-collection'

// Action type definitions
export type ActionType = 'client' | 'server'

// Base action context interface
export interface ActionContext<Params extends Record<string, any>> {
  actionType: ActionType
  actionCategory: string
  actionName: string
  actionParams: Params
  webviewId?: string
  abortController?: AbortController
}

// Action command params
export interface ActionCommandParams<Params extends Record<string, any>>
  extends ActionContext<Params> {}

export type ExecuteActionResult<ResultData> =
  | ResultData
  | Promise<ResultData>
  | AsyncGenerator<ResultData, void, unknown>

export interface SocketActionReqMsg<Params extends Record<string, any>> {
  id: string
  actionContext: ActionContext<Params>
}

export interface SocketActionResMsg<ResultData = any> {
  id: string
  actionResult: ResultData
}

export type ActionExecutor<Params extends Record<string, any>, ResultData> = (
  context: ActionContext<Params>
) => ExecuteActionResult<ResultData>

export interface ActionDefinition<
  Params extends Record<string, any>,
  ResultData = any
> {
  category: string
  name: string
  execute: ActionExecutor<Params, ResultData>
}

// for infer type from action executor
export type GetActionConfigFromExecutor<
  T extends ActionExecutor<any, any>,
  Type extends ActionType,
  CategoryName extends string = string,
  ActionName extends string = string
> = {
  context: Omit<
    Parameters<T>[0],
    'actionType' | 'actionCategory' | 'actionName'
  > & {
    actionType: Type
    actionCategory: CategoryName
    actionName: ActionName
  }
  result: ReturnType<T>
}

export type GetActionProxyExecutor<T extends ActionExecutor<any, any>> = (
  context: Omit<
    Parameters<T>[0],
    'actionType' | 'actionCategory' | 'actionName'
  >,
  onStream?: (
    result: ReturnType<T> extends AsyncGenerator<infer R, void, unknown>
      ? R
      : never
  ) => void
) => ReturnType<T>

type GetActionConfigMap<
  T extends ServerActionCollection | ClientActionCollection,
  Type extends ActionType,
  IsProxy extends boolean = false
> = {
  [K in keyof T as T[K] extends ActionExecutor<any, any>
    ? K
    : never]: IsProxy extends true
    ? GetActionProxyExecutor<
        T[K] extends ActionExecutor<any, any> ? T[K] : never
      >
    : GetActionConfigFromExecutor<
        T[K] extends ActionExecutor<any, any> ? T[K] : never,
        Type,
        T['categoryName'],
        K extends string ? K : never
      >
}

type AllServerActionsConfigs = ValueUnion<{
  [K in ServerActionCollections[number] as InstanceType<K>['categoryName']]: ValueUnion<
    GetActionConfigMap<InstanceType<K>, 'server'>
  >
}>

export type AllClientActionsConfigs = ValueUnion<{
  [K in ClientActionCollections[number] as InstanceType<K>['categoryName']]: ValueUnion<
    GetActionConfigMap<InstanceType<K>, 'client'>
  >
}>

export type AllActionsConfigs =
  | AllServerActionsConfigs
  | AllClientActionsConfigs

export type AllActionsProxy = {
  server: {
    [K in ServerActionCollections[number] as InstanceType<K>['categoryName']]: GetActionConfigMap<
      InstanceType<K>,
      'server',
      true
    >
  }
  client: {
    [K in ClientActionCollections[number] as InstanceType<K>['categoryName']]: GetActionConfigMap<
      InstanceType<K>,
      'client',
      true
    >
  }
}
