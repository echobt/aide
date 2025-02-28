import { cn } from '@webview/utils/common'
import { cva, type VariantProps } from 'class-variance-authority'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, toast as sonnerToast } from 'sonner'

// Define variants for toast styling
const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        success:
          'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-50',
        error:
          'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-50',
        warning:
          'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-50',
        info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-50'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

// Define button variants
const buttonVariants = cva(
  'inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface ToasterProps
  extends React.ComponentProps<typeof Sonner>,
    VariantProps<typeof toastVariants> {}

const Toaster2 = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-[420px]"
      toastOptions={{
        classNames: {
          toast: cn(
            toastVariants({ variant: 'default' }),
            'group-[.toaster]:backdrop-blur-sm group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg'
          ),
          title: 'text-sm font-semibold',
          description: 'text-xs group-[.toast]:text-muted-foreground mt-1',
          actionButton: cn(
            buttonVariants({ variant: 'default' }),
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground'
          ),
          cancelButton: cn(
            buttonVariants({ variant: 'outline' }),
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
          ),
          closeButton:
            'group-[.toast]:text-foreground/50 group-[.toast]:hover:text-foreground group-[.toast]:absolute group-[.toast]:top-2 group-[.toast]:right-2 group-[.toast]:opacity-70 group-[.toast]:hover:opacity-100',
          success: cn(toastVariants({ variant: 'success' })),
          error: cn(toastVariants({ variant: 'error' })),
          warning: cn(toastVariants({ variant: 'warning' })),
          info: cn(toastVariants({ variant: 'info' }))
        },
        duration: 4000
      }}
      {...props}
    />
  )
}

// Re-export toast functions with enhanced styling
export const toast = {
  ...sonnerToast, // Override with custom styling if needed
  success: (message: string, options?: any) =>
    sonnerToast.success(message, {
      ...options,
      className: toastVariants({ variant: 'success' })
    }),
  error: (message: string, options?: any) =>
    sonnerToast.error(message, {
      ...options,
      className: toastVariants({ variant: 'error' })
    }),
  warning: (message: string, options?: any) =>
    sonnerToast.warning(message, {
      ...options,
      className: toastVariants({ variant: 'warning' })
    }),
  info: (message: string, options?: any) =>
    sonnerToast.info(message, {
      ...options,
      className: toastVariants({ variant: 'info' })
    })
}

export { Toaster2 }
