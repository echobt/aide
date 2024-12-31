export interface BaseCodeBlockProps
  extends Omit<React.ComponentProps<'pre'>, 'content'> {
  content: string
  defaultExpanded?: boolean
  className?: string
  style?: React.CSSProperties
}
