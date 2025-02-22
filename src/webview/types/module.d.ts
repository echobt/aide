declare module 'flexsearch/dist/module' {
  import { Index } from 'flexsearch'

  export default Index
}

declare module 'nuqs/adapters/react-router/v7' {
  export { NuqsAdapter } from 'nuqs'
}

declare module 'dirty-json' {
  export function parse(json: string): string
}
