export class FileExcludeStrategy {
  private readonly excludePatterns = [
    // Git related
    '.git/',
    '.git_disabled/',
    // System files
    '.DS_Store',
    // Dependencies and build
    'node_modules/',
    '__pycache__/',
    'env/',
    'venv/',
    'target/dependency/',
    'build/',
    'dist/',
    'out/',
    'bundle/',
    'vendor/',
    // Temporary
    'tmp/',
    'temp/',
    'deps/',
    // Media files
    '*.jpg',
    '*.jpeg',
    '*.png',
    '*.gif',
    '*.mp3',
    '*.mp4',
    '*.wav',
    // IDE
    '.idea/',
    '.vscode/',
    '.vs/',
    // Cache files
    '*.cache',
    '*.tmp',
    '*.swp',
    '*.pyc',
    // Environment files
    '.env*',
    '*.local',
    // Archives and binaries
    '*.zip',
    '*.tar',
    '*.gz',
    '*.exe',
    '*.dll',
    // Database files
    '*.db',
    '*.sqlite'
  ]

  private excludeRegexes: RegExp[]

  constructor() {
    this.excludeRegexes = this.excludePatterns.map(pattern => {
      // Convert glob pattern to RegExp
      const escaped = pattern
        // Escape special regex characters
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        // Convert glob * to regex .*
        .replace(/\*/g, '.*')
        // Convert glob ? to regex .
        .replace(/\?/g, '.')
        // Handle directory markers
        .replace(/\/$/, '(?:/.*)?')
      return new RegExp(`^${escaped}$`)
    })
  }

  shouldExclude(relativePath: string): boolean {
    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, '/')
    return this.excludeRegexes.some(regex => regex.test(normalizedPath))
  }

  /**
   * Get all exclude patterns
   */
  getPatterns(): readonly string[] {
    return this.excludePatterns
  }

  /**
   * Add additional exclude pattern at runtime
   */
  addPattern(pattern: string): void {
    this.excludePatterns.push(pattern)
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\/$/, '(?:/.*)?')
    this.excludeRegexes.push(new RegExp(`^${escaped}$`))
  }
}
