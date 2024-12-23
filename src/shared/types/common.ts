import type { ReactNode } from 'react'
import type { ZodObject } from 'zod'

export type UnPromise<T> = T extends Promise<infer U> ? U : T
export type MaybePromise<T> = T | Promise<T>
export type ValueUnion<T> = T[keyof T]
export type ZodObjectAny = ZodObject<any, any, any, any>

export interface SFC<P = {}> {
  (props: P): ReactNode
  displayName?: string | undefined
}
