export interface CodeSnippet {
  fileHash: string
  schemeUri: string
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
  code: string
}
