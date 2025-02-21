export const getFileRangeFromCode = (
  code: string
): {
  startLine: number | undefined
  endLine: number | undefined
} => {
  const lines = code.trim().split('\n')
  let startLine: number | undefined
  let endLine: number | undefined

  for (const line of lines) {
    const trimmedLine = line.trim()

    const parseLineNumber = (prefix: string): number | undefined => {
      if (trimmedLine.startsWith(prefix)) {
        const value = trimmedLine.slice(prefix.length).trim()
        const parsed = parseInt(value, 10)
        return !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined
      }
      return undefined
    }

    const parsedStartLine = parseLineNumber('startLine:')
    if (parsedStartLine !== undefined) {
      startLine = parsedStartLine
    }

    const parsedEndLine = parseLineNumber('endLine:')
    if (parsedEndLine !== undefined) {
      endLine = parsedEndLine
    }

    // stop the loop if both values are found
    if (startLine !== undefined && endLine !== undefined) {
      break
    }
  }

  // ensure endLine is greater than or equal to startLine
  if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
    ;[startLine, endLine] = [endLine, startLine]
  }

  return { startLine, endLine }
}

export const FALLBACK_LANG = 'typescript'

/**
 * Checks if all fenced code blocks in the given markdown text are properly closed.
 * Returns true if every block is closed, or false if any block remains unclosed.
 */
export const isAllCodeBlocksClosed = (markdown: string): boolean => {
  // Split the content into lines
  const lines = markdown.split(/\r?\n/)

  let inCodeBlock = false
  let fenceCount = 0 // Stores the count of backticks for the current open fence

  for (const line of lines) {
    // Trim whitespace at both ends to avoid issues with indentation or trailing spaces
    const trimmed = line.trim()

    // This regex checks if the line starts with one or more backticks.
    // Example: "```" (3 backticks), "`````" (5 backticks), etc.
    // We'll capture the backtick sequence in group(1) and anything after in group(2).
    const match = /^(`+)(.*)$/.exec(trimmed)
    if (!match) {
      // Not a fence line, continue
      continue
    }

    const backticks = match[1] // The sequence of backticks, e.g. "```"
    const currentFenceCount = backticks?.length ?? 0

    if (!inCodeBlock) {
      // If we're not in a code block yet, this fence opens one
      inCodeBlock = true
      fenceCount = currentFenceCount
    } else {
      // If we're already in a code block, check if it matches the fence count
      // eslint-disable-next-line no-lonely-if
      if (currentFenceCount === fenceCount) {
        // If it matches, that means the code block is closed
        inCodeBlock = false
        fenceCount = 0
      }
      // If it doesn't match, it might just be a different fence (nested?), ignore
    }
  }

  // If we're still in a code block by the end of the file, it's unclosed
  return !inCodeBlock
}

/**
 * Checks if a specific code block in the markdown text is properly closed.
 * @param blockContent - The content inside the code block (excluding fence markers)
 * @param fullMarkdown - The complete markdown text
 * @returns boolean - True if the code block is properly closed
 */
export const isCodeBlockClosed = (
  blockContent: string,
  fullMarkdown: string
): boolean => {
  // Find the block content in the full markdown
  const blockIndex = fullMarkdown.indexOf(blockContent)
  if (blockIndex === -1) return false

  // Get the text after the block content
  const textAfterBlock = fullMarkdown.slice(blockIndex + blockContent.length)

  // Split into lines and look for matching closing fence
  const lines = textAfterBlock.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    // Check if line consists only of 3 or more backticks
    if (/^`{3,}\s*$/.test(trimmed)) {
      return true
    }
  }

  return false
}
