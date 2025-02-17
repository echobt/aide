import {
  BaseChannel,
  ConfiguredManagedValue,
  type AnnotationRoot
} from '@langchain/langgraph'

export type ToStateDefinition<T extends Record<string, any>> = {
  [K in keyof T]: BaseChannel | (() => BaseChannel) | ConfiguredManagedValue
}

// create AnnotationRoot type
export type CreateAnnotationRoot<T extends Record<string, any>> =
  AnnotationRoot<ToStateDefinition<T>>
