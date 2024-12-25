import { useEffect } from 'react'
import {
  useLocation,
  useNavigate,
  useSearchParams,
  type NavigateOptions
} from 'react-router'

export interface ParamConfig<T = any> {
  validate?: (value: string) => boolean
  defaultValue?: T
  onChange?: (value: T) => void
}

interface UseRouteParamsOptions {
  pathname: string
  params: Record<string, ParamConfig>
}

export const useRouteParams = ({ pathname, params }: UseRouteParamsOptions) => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const isCurrentPage = location.pathname === pathname

  // Get current values
  const values = Object.keys(params).reduce(
    (acc, key) => {
      acc[key] = searchParams.get(key) || ''
      return acc
    },
    {} as Record<string, string>
  )

  // Validate all params
  const validations = Object.entries(params).reduce(
    (acc, [key, config]) => {
      const value = values[key] || ''
      acc[key] = config.validate ? config.validate(value) : true
      return acc
    },
    {} as Record<string, boolean>
  )

  useEffect(() => {
    if (!isCurrentPage) return

    let needsRedirect = false
    const newParams = new URLSearchParams(searchParams)

    // Handle each param
    Object.entries(params).forEach(([key, config]) => {
      const value = values[key]
      const isValid = validations[key]

      if (value && isValid) {
        config.onChange?.(value)
      } else if (!value && config.defaultValue) {
        needsRedirect = true
        newParams.set(key, config.defaultValue)
      }
    })

    if (needsRedirect) {
      navigate(
        { pathname, search: newParams.toString() },
        {
          replace: true
        }
      )
    }
  }, [isCurrentPage, params, values])

  const setParam = (key: string, value: string, options?: NavigateOptions) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set(key, value)
    navigate(
      { pathname, search: newParams.toString() },
      {
        ...options,
        replace: options?.replace ?? true
      }
    )
  }

  return {
    values,
    isValid: Object.values(validations).every(Boolean),
    isCurrentPage,
    setParam
  }
}
