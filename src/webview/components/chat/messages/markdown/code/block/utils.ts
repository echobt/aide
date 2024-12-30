export const getRangeFromCode = (
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
