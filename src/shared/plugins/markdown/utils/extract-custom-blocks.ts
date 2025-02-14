/* eslint-disable no-cond-assign */
import { decode, encode } from 'js-base64'

/**
 * Represents a custom block extracted from the markdown/HTML text.
 */
export interface CustomBlock {
  /**
   * The name of the matched custom tag.
   */
  tagName: string

  /**
   * Parsed attributes from the tag.
   */
  attrs: Record<string, string | boolean | undefined>

  /**
   * The inner content of the tag.
   */
  content: string

  /**
   * Indicates whether a matching closing tag was found.
   */
  isBlockClosed: boolean
}

/**
 * The result returned by the extractCustomBlocks function.
 */
export interface ExtractCustomBlocksResult {
  /**
   * The transformed markdown where custom tags are replaced
   * by <TagName ... encodedContent="..." /> placeholders (base64).
   */
  processedMarkdown: string

  /**
   * An array of extracted custom blocks.
   */
  customBlocks: CustomBlock[]
}

/**
 * Manually parses an attribute string into a key-value object.
 * Handles patterns like:
 *   - attribute (boolean attributes, no `=`)
 *   - attribute="some value"
 *   - attribute='some value'
 *   - attribute=unquotedValue
 *
 * Examples:
 *   class="foo bar"  -> { class: "foo bar" }
 *   disabled         -> { disabled: true }
 *   data-id=123      -> { "data-id": "123" }
 *   checked=""       -> { checked: "" }
 *
 * Note: This is a simplified parser and won't handle all advanced cases
 * (like escaped quotes inside values, angle brackets, etc.).
 *
 * @param attrsStr Raw attribute string, e.g. `class="myClass" data-id="123" disabled`
 * @returns A record object with attribute names as keys, and values as string or boolean.
 */
export const parseAttrs = (
  attrsStr: string = ''
): Record<string, string | boolean | undefined> => {
  // Regex explanation:
  //  1) ([^\s=]+)                   -> capture the attribute name (one or more non-whitespace chars)
  //  2) (?:\s*=\s*(?:
  //       "([^"]*)"                 -> a double-quoted value  (group 2)
  //       |'([^']*)'                -> a single-quoted value  (group 3)
  //       |([^\s"']+)               -> an unquoted value      (group 4)
  //     ))?
  //     -> The entire =... part is optional for boolean attributes.
  //
  // If there's no =value part, we treat it as a boolean attribute -> true
  const attrRegex = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g

  const result: Record<string, string | boolean | undefined> = {}
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(attrsStr)) !== null) {
    const attrName = match[1]
    if (!attrName) continue

    const attrValue = match[2] ?? match[3] ?? match[4]
    if (attrValue === undefined) {
      // Boolean attribute
      result[attrName] = true
    } else {
      // Normal attribute
      result[attrName] = attrValue
    }
  }

  return result
}

/**
 * Re-builds an attribute string from a record object.
 * e.g. { class: "foo", disabled: true } -> 'class="foo" disabled'
 */
const buildAttrString = (
  attrs: Record<string, string | boolean | undefined>
): string => {
  const pieces: string[] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue
    if (value === true) {
      pieces.push(key) // boolean attribute
    } else {
      // You may want to do escaping if needed
      pieces.push(`${key}="${value}"`)
    }
  }
  return pieces.join(' ')
}

/**
 * Extracts custom blocks from the given markdown/HTML string.
 * Then transforms them into a new tag that preserves the original tag name/attrs,
 * but adds a new `encodedContent="..."` attribute with the base64-encoded inner content.
 *
 * If a closing tag is missing, `isBlockClosed` = false. You can decide how to handle
 * that in the final replacement string (here, we simply produce the same tag anyway).
 *
 * @param markdown The original markdown or HTML string.
 * @param tagNames An array of tag names to match, e.g. ["V1Project", "V2Chart", "SpecialComponent"].
 * @returns {ExtractCustomBlocksResult} Contains processedMarkdown & an array of extracted blocks.
 */
export const extractCustomBlocks = (
  markdown: string,
  tagNames: string[]
): ExtractCustomBlocksResult => {
  /**
   * This regex matches:
   * 1) <(tag1|tag2)(\s+...)?> - Opening tag + optional attrs
   * 2) ([\s\S]*?) - Non-greedy capture of inner content
   * 3) (<\/\1>)? - Optional closing tag
   */
  const tagPattern = new RegExp(
    `<(${tagNames.join('|')})(\\s+[^>]*?)?>([\\s\\S]*?)(<\\/\\1>|$)`,
    'ig'
  )

  const customBlocks: CustomBlock[] = []

  const processedMarkdown = markdown.replace(
    tagPattern,
    (_, tag: string, attrsStr: string, content: string, closeTag?: string) => {
      const isClosed = !!closeTag

      // parse original attrs
      const parsedAttrs = parseAttrs(attrsStr)

      // build new attr string (keep original attrs)
      const originalAttrString = buildAttrString(parsedAttrs)

      // base64 encode
      const base64Encoded = encode(content)

      // save the block info in the array for later use
      customBlocks.push({
        tagName: tag,
        attrs: parsedAttrs,
        content,
        isBlockClosed: isClosed
      })

      // build the new tag:
      // - tag name unchanged
      // - original attrs unchanged
      // - add encodedContent="..." attribute storing the Base64-encoded content
      // if the original attr string is empty, don't add an extra space
      const finalAttrString = originalAttrString ? ` ${originalAttrString}` : ''

      return `\n<${tag}${finalAttrString} encodedContent="${base64Encoded}" isBlockClosed="${isClosed}">hello</${tag}>\n`
    }
  )

  return {
    processedMarkdown,
    customBlocks
  }
}

/**
 * Parses a single custom element (e.g., <V1Project ...> ... </V1Project>) from the given `raw` string.
 * If no matching tag is found, returns null.
 * If the closing tag is missing, `isBlockClosed` will be false.
 *
 * @param tagName The specific tag name to look for, e.g. "V1Project".
 * @param raw The string that may contain the custom element (usually `node.value` in MDAST).
 * @returns A CustomBlock if found, otherwise null.
 */
export const parseCustomElement = (
  tagName: string,
  raw: string
): CustomBlock | null => {
  // Build a case-insensitive regex to match <tagName ...> ... </tagName> (with optional attrs & optional closing).
  // 1) <(tagName)(\s+...)?> - opening tag + optional attributes
  // 2) ([\s\S]*?)          - non-greedy capture of everything until
  // 3) (</tagName>)?       - optional closing tag
  const pattern = new RegExp(
    `<(${tagName})(\\s+[^>]*?)?>([\\s\\S]*?)(<\\/${tagName}>)?`,
    'i'
  )

  const match = pattern.exec(raw)
  if (!match) {
    return null
  }

  // Destructure the capturing groups
  const [, , attrsStr, content, closeTag] = match
  const isClosed = !!closeTag

  // Parse the attributes
  const parsedAttrs = parseAttrs(attrsStr)
  const finalContent = parsedAttrs.encodedContent
    ? decode(String(parsedAttrs.encodedContent))
    : content?.trim() || ''

  // Return the block object
  const block: CustomBlock = {
    tagName,
    attrs: parsedAttrs,
    content: finalContent,
    isBlockClosed: isClosed
  }

  return block
}
