import fs from 'fs/promises'
import path from 'path'
import type { Plugin } from 'vite'

interface ImageQueryPluginOptions {
  /**
   * By default, preserveQuery is set to false, meaning we do not preserve query parameters in the final image URL for non-SVG files.
   */
  preserveQuery?: boolean

  /**
   * Whether to transform <img> tags in .vue / .svelte / .html / .jsx / .tsx files by extracting query parameters into attributes.
   */
  transformHtmlImg?: boolean
}

/**
 * Convert query string like "width=200&height=100" into an object { width: "200", height: "100" }
 */
const parseImageQuery = (query: string): Record<string, string> => {
  const params = new URLSearchParams(query)
  const attrs: Record<string, string> = {}
  params.forEach((value, key) => {
    attrs[key] = value
  })
  return attrs
}

/**
 * Extract existing attributes from <svg ...> in an SVG string
 */
const parseSvgAttrs = (svgContent: string): Record<string, string> => {
  const svgTagRegex = /^<svg\s+([^>]*)>/i
  const match = svgContent.match(svgTagRegex)
  if (!match) return {}

  const attrPart = match[1]!
  const attrRegex = /(\S+)=(['"])(.*?)\2/g
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((m = attrRegex.exec(attrPart)) !== null) {
    const key = m[1]
    const value = m[3]

    if (!key || !value) continue
    attrs[key] = value
  }
  return attrs
}

/**
 * Merge new attributes (from query) into the <svg> tag, overriding existing attributes with the same name
 */
const applySvgAttrs = (
  svgContent: string,
  newAttrs: Record<string, string>
): string => {
  const svgTagRegex = /^<svg\s+([^>]*)>/i
  const match = svgContent.match(svgTagRegex)
  if (!match) return svgContent

  const existingAttrs = parseSvgAttrs(svgContent)
  const merged = { ...existingAttrs, ...newAttrs }

  const mergedAttrStr = Object.entries(merged)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')

  return svgContent.replace(svgTagRegex, `<svg ${mergedAttrStr}>`)
}

/**
 * Replace <img ... src="xxx?foo=bar" ...> in HTML-like code,
 * converting query "foo=bar" into <img foo="bar"> and removing it from the src itself.
 * This is a simple regex approach and may not handle all edge cases (multi-line, unusual attribute positions, etc.).
 */
const processImgTags = (code: string): string => {
  // Regex matches <img ... src="something?query" ...>
  const imgRegex = /<img([\s\S]*?)src=(['"])([^"']+\?[^"']+)\2([\s\S]*?)>/gi

  return code.replace(
    imgRegex,
    (fullMatch, beforeSrc, quote, srcValue, afterSrc) => {
      const [purePath, queryString] = srcValue.split('?', 2)
      if (!queryString) return fullMatch

      const queryAttrs = parseImageQuery(queryString)

      // Build new <img ...> open part
      let newTagOpen = `<img${beforeSrc} `
      for (const [key, val] of Object.entries(queryAttrs)) {
        // If the attribute already exists, don't insert again
        const attrRegex = new RegExp(`\\s${key}\\s*=`, 'i')
        if (!attrRegex.test(beforeSrc) && !attrRegex.test(afterSrc)) {
          newTagOpen += `${key}="${val}" `
        }
      }

      // Rebuild the final <img> tag with src stripped of query
      const newTag = `${newTagOpen}src=${quote}${purePath}${quote}${afterSrc}>`
      return newTag
    }
  )
}

export const imageQueryPlugin = (
  options: ImageQueryPluginOptions = {}
): Plugin => {
  const {
    preserveQuery = false, // default is false
    transformHtmlImg = true
  } = options

  // We'll consider these file extensions for transforming <img> tags
  const transformExtRE = /\.(vue|svelte|html|jsx|tsx)$/i

  return {
    name: 'vite-plugin-image-query',

    async transform(code, id) {
      // (1) Transform <img> tags if it's a .vue / .svelte / .html / .jsx / .tsx file
      if (transformHtmlImg && transformExtRE.test(id)) {
        const newCode = processImgTags(code)
        return { code: newCode, map: null }
      }

      // (2) If the id contains a query, check if it's an image file (png, jpg, etc.)
      const queryIndex = id.indexOf('?')
      if (queryIndex < 0) {
        return null
      }

      const filePath = id.slice(0, queryIndex)
      const queryString = id.slice(queryIndex + 1)

      // We only handle .png, .jpg, .jpeg, .gif, .svg, .webp
      if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(filePath)) {
        return null
      }

      const queryAttrs = parseImageQuery(queryString)

      // (2a) If it's SVG, inline-merge attributes into <svg>
      if (filePath.endsWith('.svg')) {
        try {
          const svgFullPath = path.resolve(filePath)
          const svgContent = await fs.readFile(svgFullPath, 'utf-8')
          const processedSvg = applySvgAttrs(svgContent, queryAttrs)

          // Return a blob URL so the SVG can be requested with these injected attributes
          return {
            code: `
              const svg = ${JSON.stringify(processedSvg)};
              const blob = new Blob([svg], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              export default url;
            `,
            map: null
          }
        } catch (err) {
          // this.error(`Failed to process SVG: ${filePath}\n${err}`)
          return null
        }
      }

      // (2b) Other image types - produce final URL with or without query
      const finalQuery = preserveQuery ? `?${queryString}` : ''
      return {
        code: `
          const url = new URL(${JSON.stringify(filePath + finalQuery)}, import.meta.url).href;
          export default url;
        `,
        map: null
      }
    }
  }
}
