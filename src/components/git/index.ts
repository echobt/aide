/**
 * Git Components - Export Module
 * 
 * Centralized exports for all git-related UI components.
 */

export { Bisect } from "./Bisect";
export type { BisectProps, BisectCommit, BisectMark, BisectStatus } from "./Bisect";

export { BlameView } from "./BlameView";

export { BranchComparison } from "./BranchComparison";

export { CommitGraph } from "./CommitGraph";
export type { Commit, CommitRef } from "./CommitGraph";

export { CommitRow } from "./CommitRow";
export type { CommitRowProps } from "./CommitRow";

export { GraphSvgColumn, RefBadge, GRAPH_COLORS } from "./GraphSvgRenderer";

export { ConflictResolver } from "./ConflictResolver";

export { CreateTagDialog } from "./CreateTagDialog";

export { DiffView } from "./DiffView";

export { DiffToolbar } from "./DiffToolbar";
export type { DiffToolbarProps } from "./DiffToolbar";

export { UnifiedDiffView, SplitDiffView, getLineBackground, getLineColor, getLinePrefix } from "./DiffHunkView";
export type { DiffViewHunkProps } from "./DiffHunkView";

export { DiffEditMode } from "./DiffEditMode";
export type { DiffEditModeProps } from "./DiffEditMode";

export { GitPanel } from "./GitPanel";

export { InteractiveRebase } from "./InteractiveRebase";
export type {
  InteractiveRebaseProps,
  RebaseCommit,
  RebaseAction,
  RebaseState,
  RebaseConflict
} from "./InteractiveRebase";

export { RebaseCommitRow } from "./RebaseCommitRow";
export type { RebaseCommitRowProps } from "./RebaseCommitRow";

export { RebaseStatusBanner } from "./RebaseStatusBanner";
export type { RebaseStatusBannerProps } from "./RebaseStatusBanner";

export { RebaseActionFooter } from "./RebaseActionFooter";
export type { RebaseActionFooterProps } from "./RebaseActionFooter";

export { StashPanel } from "./StashPanel";
export type { StashEntry, StashPanelProps } from "./StashPanel";

export { StashList } from "./StashList";
export type { StashListProps } from "./StashList";

export { CreateStashDialog, ConfirmStashDialog } from "./StashDialogs";
export type { CreateStashDialogProps, ConfirmStashDialogProps, ConfirmAction } from "./StashDialogs";

export { TagManager } from "./TagManager";

export { TagItem, SectionHeader, TagListPanel } from "./TagList";
export type { TagItemProps, SectionHeaderProps, TagListPanelProps } from "./TagList";

export { TagDetailPanel } from "./TagDetail";
export type { TagDetailPanelProps } from "./TagDetail";

export { DeleteTagModal, CreateBranchModal } from "./TagCreateForm";
export type { DeleteTagModalProps, CreateBranchModalProps } from "./TagCreateForm";

export { CherryPick } from "./CherryPick";
export type {
  CherryPickProps,
  CherryPickCommit,
  CherryPickState,
  CherryPickConflict,
  BranchInfo
} from "./CherryPick";

export { MergeEditor, parseConflictMarkers } from "./MergeEditor";
export type {
  MergeEditorProps,
  ConflictRegion,
  MergeViewMode
} from "./MergeEditor";

export { GitLFSManager } from "./GitLFSManager";
export type {
  GitLFSManagerProps,
  LFSFile,
  LFSLock,
  LFSStorageInfo,
  LFSStatus
} from "./GitLFSManager";

export { LFSTrackDialog } from "./LFSTrackDialog";
export type { LFSTrackDialogProps } from "./LFSTrackDialog";

export { 
  LFSFileIndicator, 
  LFSDirectoryIndicator,
  invalidateLFSCache,
  clearLFSCache 
} from "./LFSFileIndicator";
export type {
  LFSFileIndicatorProps,
  LFSDirectoryIndicatorProps,
  LFSFileStatus,
  LFSFileInfo
} from "./LFSFileIndicator";

export { IncomingOutgoingView, IncomingOutgoingSection } from "./IncomingOutgoingView";
export type {
  IncomingOutgoingViewProps,
  IncomingOutgoingSectionProps,
  CommitInfo,
  IncomingOutgoingState,
  CommitFile as IncomingOutgoingCommitFile
} from "./IncomingOutgoingView";

export { WorktreeManager } from "./WorktreeManager";
export type { WorktreeManagerProps } from "./WorktreeManager";

export { AddWorktreeDialog } from "./AddWorktreeDialog";
export type { AddWorktreeDialogProps } from "./AddWorktreeDialog";

export { CloneRepositoryDialog } from "./CloneRepositoryDialog";
export type { CloneRepositoryDialogProps } from "./CloneRepositoryDialog";

export { MergeBranchDialog } from "./MergeBranchDialog";
export type { MergeBranchDialogProps } from "./MergeBranchDialog";

export { PublishBranchDialog } from "./PublishBranchDialog";
export type { PublishBranchDialogProps } from "./PublishBranchDialog";

export { StashDiffView } from "./StashDiffView";
export type { StashDiffViewProps } from "./StashDiffView";

export { MultiDiffEditor } from "../editor/MultiDiffEditor";
export type { MultiDiffEditorProps, FileDiff, FileStatus } from "../editor/MultiDiffEditor";
