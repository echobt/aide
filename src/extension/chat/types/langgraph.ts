import {
  BaseChannel,
  ConfiguredManagedValue,
  type _INTERNAL_ANNOTATION_ROOT
} from '@langchain/langgraph'

export type ToStateDefinition<T extends Record<string, any>> = {
  [K in keyof T]: BaseChannel | (() => BaseChannel) | ConfiguredManagedValue
}

// create AnnotationRoot type
export type CreateAnnotationRoot<T extends Record<string, any>> =
  _INTERNAL_ANNOTATION_ROOT<ToStateDefinition<T>>
