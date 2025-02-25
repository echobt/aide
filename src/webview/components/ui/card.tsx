import * as React from 'react'
import { cn } from '@webview/utils/common'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
  withEffect?: boolean
}

const Card: React.FC<CardProps> = ({
  ref,
  className,
  withEffect,
  ...props
}) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border bg-card text-card-foreground shadow-sm',
      withEffect && [
        'h-full border-border/40 bg-gradient-to-b from-card to-card/95 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 dark:hover:border-primary/30 relative',
        'group/card'
      ],
      className
    )}
    {...props}
  >
    {withEffect ? (
      <>
        <div className="absolute inset-0 h-full bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
        <div className="relative h-full">{props.children}</div>
      </>
    ) : (
      props.children
    )}
  </div>
)
Card.displayName = 'Card'

const CardHeader: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }
> = ({ ref, className, ...props }) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
)
CardHeader.displayName = 'CardHeader'

const CardTitle: React.FC<
  React.HTMLAttributes<HTMLHeadingElement> & {
    ref?: React.Ref<HTMLHeadingElement>
  }
> = ({ ref, className, ...props }) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
)
CardTitle.displayName = 'CardTitle'

const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement> & {
    ref?: React.Ref<HTMLParagraphElement>
  }
> = ({ ref, className, ...props }) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)
CardDescription.displayName = 'CardDescription'

const CardContent: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }
> = ({ ref, className, ...props }) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
)
CardContent.displayName = 'CardContent'

const CardFooter: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }
> = ({ ref, className, ...props }) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
