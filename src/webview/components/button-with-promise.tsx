import { useEffect, useState } from 'react'
import { cn } from '@webview/utils/common'
import { CheckIcon, XIcon } from 'lucide-react'

import { LoadingSpinner } from './loading-spinner'
import { Button, type ButtonProps } from './ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip'

export interface ButtonWithPromiseRef extends HTMLButtonElement {}

export type ButtonWithPromiseProps = ButtonProps & {
  ref?: React.Ref<ButtonWithPromiseRef>
  tooltip?: string
  side?: React.ComponentProps<typeof TooltipContent>['side']
  promiseFn: () => Promise<any>
  successDuration?: number
  errorDuration?: number
  iconClassName?: string
  onSuccess?: () => void
  onError?: (error: any) => void
  loadingText?: string
  successText?: string
  errorText?: string
  buildChildren?: (icon?: React.ReactNode | null) => React.ReactNode
}

export const ButtonWithPromise: React.FC<ButtonWithPromiseProps> = ({
  ref,
  children,
  tooltip,
  side = 'top',
  promiseFn,
  successDuration = 2000,
  errorDuration = 2000,
  iconClassName,
  onSuccess,
  onError,
  loadingText,
  successText,
  errorText,
  className,
  disabled,
  buildChildren,
  ...rest
}) => {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (status === 'success') {
      timer = setTimeout(() => {
        setStatus('idle')
      }, successDuration)
    } else if (status === 'error') {
      timer = setTimeout(() => {
        setStatus('idle')
      }, errorDuration)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [status, successDuration, errorDuration])

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (rest.onClick) {
      rest.onClick(e)
    }

    if (status === 'loading') return

    setStatus('loading')
    try {
      await promiseFn()
      setStatus('success')
      onSuccess?.()
    } catch (error) {
      setStatus('error')
      onError?.(error)
    }
  }

  const getIcon = (): React.ReactNode => {
    const finalIconClassName = cn('size-4', iconClassName)
    switch (status) {
      case 'loading':
        return <LoadingSpinner className={finalIconClassName} />
      case 'success':
        return <CheckIcon className={finalIconClassName} />
      case 'error':
        return <XIcon className={finalIconClassName} />
      default:
        return null
    }
  }
  const icon = getIcon()

  const getTooltipText = () => {
    switch (status) {
      case 'loading':
        return loadingText || tooltip
      case 'success':
        return successText || tooltip
      case 'error':
        return errorText || tooltip
      default:
        return tooltip
    }
  }

  const button = (
    <Button
      ref={ref}
      className={cn(
        status === 'success' &&
          'bg-success text-success-foreground hover:bg-success/90',
        status === 'error' &&
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className
      )}
      disabled={disabled || status === 'loading'}
      onClick={handleClick}
      {...rest}
    >
      {buildChildren
        ? buildChildren(icon)
        : status === 'idle'
          ? children
          : icon}
    </Button>
  )

  if (!tooltip && !loadingText && !successText && !errorText) {
    return button
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        {getTooltipText() && (
          <TooltipContent hideWhenDetached side={side}>
            {getTooltipText()}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
