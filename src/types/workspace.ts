/**
 * Workspace Types
 *
 * Centralized type definitions for workspace and project-related functionality
 * including folders, workspace files, and recent workspaces.
 */

// ============================================================================
// Workspace Folder Types
// ============================================================================

/**
 * Represents a folder within the workspace.
 */
export interface WorkspaceFolder {
  /** Absolute path to the folder */
  path: string;
  /** Display name for the folder */
  name: string;
  /** Custom color for the folder header */
  color?: string;
  /** Custom icon identifier */
  icon?: string;
}

/**
 * Represents a recent workspace entry.
 */
export interface RecentWorkspace {
  /** Unique identifier */
  id: string;
  /** Path to the workspace file (.cortex-workspace) or folder path for single-folder workspaces */
  path: string;
  /** Display name for the workspace */
  name: string;
  /** Timestamp of last opened */
  lastOpened: number;
  /** Whether this is a multi-folder workspace file */
  isWorkspaceFile: boolean;
  /** Number of folders in the workspace (for display) */
  folderCount: number;
}

// ============================================================================
// Workspace File Types
// ============================================================================

/**
 * User-defined settings for the workspace.
 */
export interface WorkspaceSettings {
  [key: string]: unknown;
}

/**
 * Cortex workspace file format (.cortex-workspace).
 */
export interface WorkspaceFile {
  /** Array of workspace folders */
  folders: Array<{
    path: string;
    name?: string;
    color?: string;
    icon?: string;
  }>;
  /** Workspace settings */
  settings: WorkspaceSettings;
}

/**
 * VS Code .code-workspace file format for compatibility.
 */
export interface CodeWorkspaceFile {
  /** Array of workspace folders in VS Code format */
  folders: Array<{ path: string; name?: string }>;
  /** VS Code settings */
  settings?: Record<string, unknown>;
  /** VS Code extensions recommendations */
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
  };
  /** VS Code launch configurations */
  launch?: Record<string, unknown>;
  /** VS Code tasks */
  tasks?: Record<string, unknown>;
}

/**
 * Workspace format type.
 */
export type WorkspaceFormat = "cortex" | "vscode";

// ============================================================================
// File Tree Types
// ============================================================================

/**
 * Represents a file or folder in the file tree.
 */
export interface FileEntry {
  /** File or folder name */
  name: string;
  /** Full path */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink?: boolean;
  /** Children entries (for directories) */
  children?: FileEntry[];
  /** Whether children have been loaded */
  childrenLoaded?: boolean;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  modifiedAt?: number;
}

/**
 * File metadata information.
 */
export interface FileMetadata {
  /** File size in bytes */
  size: number;
  /** Whether the path is a file */
  isFile: boolean;
  /** Whether the path is a directory */
  isDirectory: boolean;
  /** Whether the path is a symbolic link */
  isSymlink: boolean;
  /** Last modified time (Unix timestamp ms) */
  modified: number;
  /** Created time (Unix timestamp ms) */
  created: number;
  /** Whether the file is read-only */
  readonly: boolean;
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project configuration.
 */
export interface ProjectConfig {
  /** Project name */
  name: string;
  /** Root path */
  rootPath: string;
  /** Project description */
  description?: string;
  /** Associated git repository URL */
  repositoryUrl?: string;
  /** Project-specific settings */
  settings?: WorkspaceSettings;
}

/**
 * Predefined folder colors for multi-root workspaces.
 */
export interface FolderColor {
  /** Display name */
  name: string;
  /** Hex color value or undefined for default */
  value: string | undefined;
}

// ============================================================================
// Trust Types
// ============================================================================

/**
 * Workspace trust level.
 */
export type WorkspaceTrustLevel = "trusted" | "untrusted" | "unknown";

/**
 * Workspace trust state.
 */
export interface WorkspaceTrustState {
  /** Current trust level */
  level: WorkspaceTrustLevel;
  /** When trust was granted (if trusted) */
  trustedAt?: number;
  /** User who granted trust */
  trustedBy?: string;
}
