export interface BaseCodeBlockProps
  extends Omit<React.ComponentProps<'pre'>, 'content'> {
  defaultExpanded?: boolean
  className?: string
  style?: React.CSSProperties
}
