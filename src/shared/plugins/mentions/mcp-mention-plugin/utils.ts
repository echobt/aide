import type { McpConfigWithFullInfo } from '@extension/actions/mcp-actions'

export const getOriginalMcpConfig = (config: McpConfigWithFullInfo) => {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { status, listPrompts, listTools, ...originConfig } = config
  return originConfig
}
