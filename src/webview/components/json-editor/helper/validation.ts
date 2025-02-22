import { getErrorMsg } from '@shared/utils/common'
import Ajv, { ErrorObject, JSONSchemaType } from 'ajv'
import addFormats from 'ajv-formats'
import dirtyJson from 'dirty-json'

const ajv = new Ajv({
  allErrors: true,
  verbose: true // Add more detailed error messages
})
addFormats(ajv)

export interface ValidationError {
  path: string
  message: string
  line?: number
  column?: number
}

// Add function to attempt fixing invalid JSON
export const tryFixJson = (jsonString: string): string => {
  try {
    if (!jsonString) return '{}'
    const fixed = dirtyJson.parse(jsonString)
    return JSON.stringify(fixed, null, 2)
  } catch (error) {
    throw new Error(`Failed to fix JSON: ${getErrorMsg(error)}`)
  }
}

export const validateJson = (
  json: unknown,
  schema?: JSONSchemaType<unknown>
): ValidationError[] => {
  try {
    if (schema) {
      const validate = ajv.compile(schema)
      const valid = validate(json)

      if (!valid) {
        return (validate.errors || []).map((err: ErrorObject) => ({
          path: err.instancePath || '/',
          message: err.message || 'Unknown error',
          // Add line/column info if available from error
          line: (err.data as any)?.line,
          column: (err.data as any)?.column
        }))
      }
    }

    // Basic JSON structure validation
    JSON.stringify(json)
    return []
  } catch (error) {
    return [
      {
        path: '',
        message: error instanceof Error ? error.message : 'Invalid JSON'
      }
    ]
  }
}

// Add function to format JSON with proper indentation
export const formatJson = (json: unknown): string => {
  try {
    return JSON.stringify(json, null, 2)
  } catch {
    throw new Error('Failed to format JSON')
  }
}
