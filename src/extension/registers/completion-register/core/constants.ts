/**
 * Language to file extension mapping
 */
export const languageExtensions: Record<string, string> = {
  javascript: '.js',
  typescript: '.ts',
  javascriptreact: '.jsx',
  typescriptreact: '.tsx',
  html: '.html',
  css: '.css',
  json: '.json',
  python: '.py',
  java: '.java',
  csharp: '.cs',
  cpp: '.cpp',
  c: '.c',
  go: '.go',
  rust: '.rs',
  php: '.php',
  ruby: '.rb',
  markdown: '.md',
  plaintext: '.txt'
}

/**
 * Extension to language mapping
 */
export const extensionToLanguage: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.py': 'python',
  '.java': 'java',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.md': 'markdown',
  '.txt': 'plaintext'
}

/**
 * Dependencies files by language
 */
export const dependenciesFiles: Record<string, string[]> = {
  javascript: ['package.json'],
  typescript: ['package.json', 'tsconfig.json'],
  javascriptreact: ['package.json'],
  typescriptreact: ['package.json', 'tsconfig.json'],
  python: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  rust: ['Cargo.toml'],
  go: ['go.mod']
}

/**
 * Completion request configuration
 */
export const completionConfig = {
  /**
   * Inline request timeout (milliseconds)
   */
  inlineRequestTimeout: 10000,

  /**
   * Maximum number of results
   */
  maxResults: 5,

  /**
   * Default snooze duration (minutes)
   */
  defaultSnoozeDuration: 1,

  /**
   * Character limit for context
   */
  charLimit: 1000,

  /**
   * Debounce delay for inline completions (milliseconds)
   */
  debounceDelay: 300,

  /**
   * Minimum time between completions (milliseconds)
   */
  minTimeBetweenCompletions: 1000,

  /**
   * Retry interval (milliseconds)
   */
  retryInterval: 200,

  /**
   * Default retry timeout (milliseconds)
   */
  defaultRetryTimeout: 1000
}

/**
 * Snippet completion triggers
 */
export const snippetCompletionTriggers = [
  ' ',
  '.',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  ',',
  ':',
  "'",
  '"',
  '=',
  '<',
  '>',
  '/',
  '\\',
  '+',
  '-',
  '|',
  '&',
  '*',
  '%',
  '=',
  '$',
  '#',
  '@',
  '!'
]

/**
 * API configuration
 */
export const apiConfig = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  key: 'xxx', // placeholder
  model: 'gpt-4'
}
