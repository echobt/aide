import { capitalizeFirstLetter } from '@shared/utils/common'
import { cn } from '@webview/utils/common'

export type StatusState =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'completed'
  | 'processing'
  | 'pending'

interface StatusBadgeProps {
  state: StatusState
  label?: string
  error?: string
  className?: string
}

export const StatusBadge = ({
  state,
  label,
  error,
  className
}: StatusBadgeProps) => {
  // Map status to colors
  const statusColor = {
    connected: 'text-green-500 bg-green-500/10 border-green-500/20',
    completed: 'text-green-500 bg-green-500/10 border-green-500/20',
    error: 'text-red-500 bg-red-500/10 border-red-500/20',
    disconnected: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    pending: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    processing: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
  }[state]

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full w-fit border',
          statusColor
        )}
      >
        {label || capitalizeFirstLetter(state)}
      </div>
      {error && (
        <div className="text-[0.65rem] text-destructive/90 bg-destructive/5 p-1.5 rounded-md border border-destructive/10">
          {error}
        </div>
      )}
    </div>
  )
}
