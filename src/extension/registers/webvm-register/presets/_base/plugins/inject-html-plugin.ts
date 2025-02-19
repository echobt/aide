import type { Plugin } from 'vite'

interface HTMLElementOptions {
  tagName: string
  attributes?: Record<string, string>
  children?: string
}

interface InjectOptions {
  target: 'head' | 'body'
  elements: HTMLElementOptions[]
}

export const injectHtmlPlugin = (options: InjectOptions): Plugin => ({
  name: 'vite-plugin-inject-html',
  transformIndexHtml(html) {
    const { target, elements } = options

    let result = html
    const closeTag = `</${target}>`
    const closeIndex = result.lastIndexOf(closeTag)

    if (closeIndex === -1) {
      throw new Error(`Could not find closing ${target} tag in HTML`)
    }

    for (const element of elements) {
      const { tagName, attributes = {}, children = '' } = element

      // Generate element string
      const attrs = Object.entries(attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')

      const elementString = `<${tagName}${attrs ? ` ${attrs}` : ''}>${children}</${tagName}>`

      // Check if element already exists
      if (result.includes(elementString)) {
        continue
      }

      result =
        result.slice(0, closeIndex) + elementString + result.slice(closeIndex)
    }

    return result
  }
})
