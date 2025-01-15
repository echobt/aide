export interface FileDiff {
  relativePath: string
  absolutePath: string
  before: string
  after: string
}

export interface FileCheckpointOptions {
  workingDirectory: string
  taskId: string
  storageDir: string
}

export interface IFileSystem {
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: Buffer): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>
  readdir(path: string, options?: { withFileTypes: boolean }): Promise<any[]>
  unlink(path: string): Promise<void>
  rmdir(path: string): Promise<void>
}

export interface IGitOperations {
  init(): Promise<void>
  add(path: string): Promise<void>
  commit(message: string): Promise<string>
  checkout(ref: string): Promise<void>
  listFiles(): Promise<string[]>
  getDiff(oldHash?: string, newHash?: string): Promise<FileDiff[]>
}
