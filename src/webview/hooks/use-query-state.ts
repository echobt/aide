import { useSearchParams } from 'react-router'

/**
 * Options for useQueryState hook
 */
export interface UseQueryStateOptions<T> {
  /**
   * Default value when query parameter is not present
   */
  defaultValue?: T

  /**
   * Custom parser function to convert string to value
   */
  parse?: (value: string | null) => T | null

  /**
   * Custom serializer function to convert value to string
   */
  serialize?: (value: T) => string

  /**
   * Whether to replace current history entry or push a new one
   */
  history?: 'replace' | 'push'

  /**
   * Whether to scroll to top after updating query
   */
  scroll?: boolean
}

/**
 * Custom hook to synchronize state with URL query parameters
 *
 * @param key The URL query parameter key
 * @param options Configuration options
 * @returns [value, setValue] tuple similar to useState
 */
export const useQueryState = <T = string>(
  key: string,
  options: UseQueryStateOptions<T> = {}
): [
  T | null,
  (
    value: T | null | ((prev: T | null) => T | null),
    updateOptions?: Partial<UseQueryStateOptions<T>>
  ) => Promise<URLSearchParams>
] => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Default parser/serializer functions
  const defaultParse = (value: string | null): any => value
  const defaultSerialize = (value: any): string => String(value)

  // Use provided or default parser/serializer
  const parse = options.parse || defaultParse
  const serialize = options.serialize || defaultSerialize

  // Get initial value from URL or use default
  const getValueFromUrl = (): T | null => {
    const paramValue = searchParams.get(key)
    if (paramValue === null) {
      return options.defaultValue !== undefined ? options.defaultValue : null
    }
    return parse(paramValue)
  }

  const value = getValueFromUrl()

  // Function to update both state and URL
  const updateValue = async (
    newValueOrUpdater: T | null | ((prev: T | null) => T | null),
    updateOptions?: Partial<UseQueryStateOptions<T>>
  ): Promise<URLSearchParams> => {
    // Merge options
    const mergedOptions = { ...options, ...updateOptions }
    const { scroll = false } = mergedOptions

    // Calculate new value
    const newValue =
      typeof newValueOrUpdater === 'function'
        ? (newValueOrUpdater as Function)(value)
        : newValueOrUpdater

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams)

    if (newValue === null) {
      newSearchParams.delete(key)
    } else {
      newSearchParams.set(key, serialize(newValue))
    }

    setSearchParams(newSearchParams)

    // Scroll to top if requested
    if (scroll) {
      window.scrollTo(0, 0)
    }

    return newSearchParams
  }

  return [value, updateValue]
}

/**
 * Type for query state parser
 */
export interface QueryStateParser<T> {
  parse: (value: string | null) => T | null
  serialize: (value: T) => string
  withDefault: (defaultValue: T) => QueryStateParserWithDefault<T>
}

/**
 * Type for query state parser with default value
 */
export interface QueryStateParserWithDefault<T> extends QueryStateParser<T> {
  defaultValue: T
}

/**
 * Create a parser for integer values
 */
export const parseAsInteger: QueryStateParser<number> = {
  parse: value => (value === null ? null : (parseInt(value, 10) ?? null)),
  serialize: value => value.toString(),
  withDefault: defaultValue => ({
    ...parseAsInteger,
    defaultValue
  })
}

/**
 * Create a parser for boolean values
 */
export const parseAsBoolean: QueryStateParser<boolean> = {
  parse: value => {
    if (value === null) return null
    return value === 'true' || value === '1'
  },
  serialize: value => (value ? 'true' : 'false'),
  withDefault: defaultValue => ({
    ...parseAsBoolean,
    defaultValue
  })
}

/**
 * Create a parser for string values
 */
export const parseAsString: QueryStateParser<string> = {
  parse: value => value,
  serialize: value => value,
  withDefault: defaultValue => ({
    ...parseAsString,
    defaultValue
  })
}

/**
 * Create a parser for float values
 */
export const parseAsFloat: QueryStateParser<number> = {
  parse: value => (value === null ? null : parseFloat(value) || null),
  serialize: value => value.toString(),
  withDefault: defaultValue => ({
    ...parseAsFloat,
    defaultValue
  })
}

/**
 * Create a parser for string enum values
 */
export const parseAsStringEnum = <T extends string>(
  validValues: T[]
): QueryStateParser<T> => ({
  parse: value => {
    if (value === null) return null
    return validValues.includes(value as T) ? (value as T) : null
  },
  serialize: value => value,
  withDefault: (defaultValue: T) => ({
    ...parseAsStringEnum(validValues),
    defaultValue
  })
})

/**
 * Hook to manage multiple query parameters at once
 *
 * @param keyMap Object mapping keys to their parser configurations
 * @param options Global options for all keys
 * @returns [values, setValues] tuple
 */
export const useQueryStates = <T extends Record<string, any>>(
  keyMap: Record<
    keyof T,
    {
      parse?: (value: string | null) => T[keyof T] | null
      serialize?: (value: T[keyof T]) => string
      defaultValue?: T[keyof T]
    }
  >,
  options: Omit<
    UseQueryStateOptions<any>,
    'parse' | 'serialize' | 'defaultValue'
  > = {}
): [
  { [K in keyof T]: T[K] | null },
  (
    values:
      | Partial<{ [K in keyof T]: T[K] | null }>
      | ((prev: { [K in keyof T]: T[K] | null }) => Partial<{
          [K in keyof T]: T[K] | null
        }>),
    updateOptions?: Partial<UseQueryStateOptions<any>>
  ) => Promise<URLSearchParams>
] => {
  const [searchParams, setSearchParams] = useSearchParams()

  const getValuesFromUrl = () => {
    const newValues = {} as { [K in keyof T]: T[K] | null }

    Object.entries(keyMap).forEach(([key, config]) => {
      const paramValue = searchParams.get(key)
      const parse =
        config.parse ||
        ((value: string | null) => value as unknown as T[keyof T])

      let newValue
      if (paramValue === null) {
        newValue =
          config.defaultValue !== undefined ? config.defaultValue : null
      } else {
        newValue = parse(paramValue)
      }

      newValues[key as keyof T] = newValue
    })

    return newValues
  }

  const values = getValuesFromUrl()

  // Function to update values and URL
  const updateValues = async (
    newValuesOrUpdater:
      | Partial<{ [K in keyof T]: T[K] | null }>
      | ((prev: { [K in keyof T]: T[K] | null }) => Partial<{
          [K in keyof T]: T[K] | null
        }>),
    updateOptions?: Partial<UseQueryStateOptions<any>>
  ): Promise<URLSearchParams> => {
    // Merge options
    const mergedOptions = { ...options, ...updateOptions }
    const { scroll = false } = mergedOptions

    // Calculate new values
    const newPartialValues =
      typeof newValuesOrUpdater === 'function'
        ? (newValuesOrUpdater as Function)(values)
        : newValuesOrUpdater

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams)

    Object.entries(newPartialValues).forEach(([key, value]) => {
      const config = keyMap[key as keyof T]
      const serialize = config?.serialize || ((val: any) => String(val))

      if (value === null) {
        newSearchParams.delete(key)
      } else {
        newSearchParams.set(key, serialize(value as T[keyof T]))
      }
    })

    setSearchParams(newSearchParams)

    // Scroll to top if requested
    if (scroll) {
      window.scrollTo(0, 0)
    }

    return newSearchParams
  }

  return [values, updateValues]
}
