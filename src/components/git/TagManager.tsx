import { createSignal, Show, onMount, onCleanup, createMemo, createEffect } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  IconButton,
  Input,
  Badge,
  Text,
} from "@/components/ui";
import { CreateTagDialog } from "@/components/git/CreateTagDialog";
import { TagListPanel } from "@/components/git/TagList";
import { TagDetailPanel } from "@/components/git/TagDetail";
import { DeleteTagModal, CreateBranchModal } from "@/components/git/TagCreateForm";
import {
  gitTagList,
  gitTagDelete,
  gitTagPush,
  gitTagPushAll,
  gitCheckoutTag,
  gitCreateBranchFromTag,
  gitTagInfo,
  type GitTag,
} from "@/utils/tauri-api";

export interface TagManagerProps {
  repoPath: string;
  onClose?: () => void;
}

type SortOrder = "name-asc" | "name-desc" | "date-asc" | "date-desc";

function Header(props: {
  total: number; loading: boolean; operationLoading: string | null;
  localTagCount: number; onCreateTag: () => void; onPushAllTags: () => void;
  onRefresh: () => void; onClose?: () => void;
}) {
  return (
    <div style={{
      display: "flex", "align-items": "center", "justify-content": "space-between",
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      "border-bottom": `1px solid ${tokens.colors.border.divider}`, "flex-shrink": "0",
    }}>
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
        <Icon name="tag" style={{ width: "16px", height: "16px", color: tokens.colors.icon.default }} />
        <Text style={{ "font-size": "14px", "font-weight": "600", color: tokens.colors.text.primary }}>Tags</Text>
        <Badge variant="default" size="sm">{props.total}</Badge>
      </div>
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        <IconButton tooltip="Create Tag" onClick={props.onCreateTag}>
          <Icon name="plus" style={{ width: "16px", height: "16px" }} />
        </IconButton>
        <IconButton tooltip="Push All Tags" onClick={props.onPushAllTags} disabled={props.operationLoading === "push-all" || props.localTagCount === 0}>
          <Show when={props.operationLoading === "push-all"} fallback={<Icon name="upload" style={{ width: "16px", height: "16px" }} />}>
            <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
          </Show>
        </IconButton>
        <IconButton tooltip="Refresh" onClick={props.onRefresh} disabled={props.loading}>
          <Show when={props.loading} fallback={<Icon name="rotate" style={{ width: "16px", height: "16px" }} />}>
            <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
          </Show>
        </IconButton>
        <Show when={props.onClose}>
          <IconButton tooltip="Close" onClick={props.onClose}>
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

function ErrorBanner(props: { error: string; onClear: () => void }) {
  return (
    <div style={{
      display: "flex", "align-items": "center", gap: tokens.spacing.md,
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, "font-size": "12px",
      background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
      color: tokens.colors.semantic.error,
    }}>
      <Text as="span" style={{ flex: "1" }}>{props.error}</Text>
      <IconButton size="sm" onClick={props.onClear}>
        <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
      </IconButton>
    </div>
  );
}

function SearchBar(props: {
  searchQuery: string; sortOrder: string;
  onSearchChange: (v: string) => void; onSortChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: "flex", "align-items": "center", gap: tokens.spacing.md,
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      "border-bottom": `1px solid ${tokens.colors.border.divider}`, "flex-shrink": "0",
    }}>
      <div style={{ flex: "1" }}>
        <Input
          placeholder="Search tags..."
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          icon={<Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />}
          iconRight={
            <Show when={props.searchQuery}>
              <IconButton size="sm" onClick={() => props.onSearchChange("")} style={{ position: "absolute", right: "4px" }}>
                <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
              </IconButton>
            </Show>
          }
        />
      </div>
      <select
        value={props.sortOrder}
        onChange={(e) => props.onSortChange(e.currentTarget.value)}
        style={{
          height: "28px", padding: `0 ${tokens.spacing.md}`,
          background: "var(--jb-input-bg)", border: "var(--jb-input-border)",
          "border-radius": "var(--jb-input-radius)", color: "var(--jb-input-color)",
          "font-size": "12px", cursor: "pointer",
        }}
      >
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="name-asc">Name A-Z</option>
        <option value="name-desc">Name Z-A</option>
      </select>
    </div>
  );
}

export function TagManager(props: TagManagerProps) {
  const [tags, setTags] = createSignal<GitTag[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("date-desc");
  const [selectedTag, setSelectedTag] = createSignal<GitTag | null>(null);
  const [tagDetailsLoading, setTagDetailsLoading] = createSignal(false);
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<GitTag | null>(null);
  const [deleteRemoteToo, setDeleteRemoteToo] = createSignal(false);
  const [showBranchDialog, setShowBranchDialog] = createSignal<GitTag | null>(null);
  const [newBranchName, setNewBranchName] = createSignal("");
  const [copiedTag, setCopiedTag] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["local", "remote"]));

  onMount(() => {
    fetchTags();

    const handleOpenCreateDialog = () => {
      setShowCreateDialog(true);
    };

    window.addEventListener("tags:open-create-dialog", handleOpenCreateDialog);

    onCleanup(() => {
      window.removeEventListener("tags:open-create-dialog", handleOpenCreateDialog);
    });
  });

  createEffect(() => {
    const tag = selectedTag();
    if (tag) {
      fetchTagDetails(tag.name);
    }
  });

  const withOp = async (key: string, fn: () => Promise<void>) => {
    setOperationLoading(key);
    try { await fn(); } catch (err) { setError(`Operation failed: ${err}`); } finally { setOperationLoading(null); }
  };

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try { setTags(await gitTagList(props.repoPath)); }
    catch (err) { setError(`Failed to fetch tags: ${err}`); }
    finally { setLoading(false); }
  };

  const fetchTagDetails = async (tagName: string) => {
    setTagDetailsLoading(true);
    try { await gitTagInfo(props.repoPath, tagName); }
    catch (err) { setError(`Failed to fetch tag details: ${err}`); }
    finally { setTagDetailsLoading(false); }
  };

  const handleTagCreated = async (tag: GitTag) => {
    setShowCreateDialog(false);
    await fetchTags();
    setSelectedTag(tag);
  };

  const handleDeleteTag = async (tag: GitTag, deleteRemote: boolean) => {
    await withOp(`delete-${tag.name}`, async () => {
      await gitTagDelete(props.repoPath, tag.name, deleteRemote);
      setShowDeleteConfirm(null);
      if (selectedTag()?.name === tag.name) setSelectedTag(null);
      await fetchTags();
    });
  };

  const handlePushTag = async (tagName: string) => {
    await withOp(`push-${tagName}`, async () => { await gitTagPush(props.repoPath, tagName); await fetchTags(); });
  };

  const handlePushAllTags = async () => {
    await withOp("push-all", async () => { await gitTagPushAll(props.repoPath); await fetchTags(); });
  };

  const handleCheckoutTag = async (tagName: string) => {
    await withOp(`checkout-${tagName}`, async () => { await gitCheckoutTag(props.repoPath, tagName); });
  };

  const handleCreateBranchFromTag = async () => {
    const tag = showBranchDialog();
    const branchName = newBranchName().trim();
    if (!tag || !branchName) return;
    await withOp(`branch-${tag.name}`, async () => {
      await gitCreateBranchFromTag(props.repoPath, tag.name, branchName);
      setShowBranchDialog(null);
      setNewBranchName("");
    });
  };

  const copyToClipboard = async (text: string, tagName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTag(tagName);
      setTimeout(() => setCopiedTag(null), 2000);
    } catch (_) { setError("Failed to copy to clipboard"); }
  };

  const filteredTags = createMemo(() => {
    const query = searchQuery().toLowerCase();
    let filtered = tags();
    if (query) {
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(query) ||
        tag.message?.toLowerCase().includes(query) ||
        tag.tagger?.toLowerCase().includes(query)
      );
    }
    const order = sortOrder();
    return [...filtered].sort((a, b) => {
      switch (order) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "date-asc": return (a.date?.getTime() || 0) - (b.date?.getTime() || 0);
        case "date-desc": default: return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
      }
    });
  });

  const localTags = createMemo(() => filteredTags().filter(t => !t.isPushed));
  const remoteTags = createMemo(() => filteredTags().filter(t => t.isPushed));

  const toggleSection = (section: string) => {
    const current = expandedSections();
    const newSet = new Set(current);
    if (newSet.has(section)) { newSet.delete(section); } else { newSet.add(section); }
    setExpandedSections(newSet);
  };

  const formatDate = (date?: Date): string => {
    if (!date) return "Unknown date";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const clearError = () => setError(null);

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden", background: tokens.colors.surface.panel }}>
      <Header
        total={tags().length}
        loading={loading()}
        operationLoading={operationLoading()}
        localTagCount={localTags().length}
        onCreateTag={() => setShowCreateDialog(true)}
        onPushAllTags={handlePushAllTags}
        onRefresh={fetchTags}
        onClose={props.onClose}
      />

      <Show when={error()}>
        <ErrorBanner error={error()!} onClear={clearError} />
      </Show>

      <SearchBar
        searchQuery={searchQuery()}
        sortOrder={sortOrder()}
        onSearchChange={setSearchQuery}
        onSortChange={(v) => setSortOrder(v as SortOrder)}
      />

      <div style={{ flex: "1", display: "flex", overflow: "hidden" }}>
        <TagListPanel
          loading={loading()}
          tags={tags()}
          localTags={localTags()}
          remoteTags={remoteTags()}
          filteredTags={filteredTags()}
          searchQuery={searchQuery()}
          selectedTag={selectedTag()}
          expandedSections={expandedSections()}
          operationLoading={operationLoading()}
          onSelectTag={setSelectedTag}
          onToggleSection={toggleSection}
          onCreateTag={() => setShowCreateDialog(true)}
          onPushTag={handlePushTag}
          onDeleteTag={(tag) => setShowDeleteConfirm(tag)}
        />

        <Show when={selectedTag()}>
          <TagDetailPanel
            tag={selectedTag()!}
            tagDetailsLoading={tagDetailsLoading()}
            operationLoading={operationLoading()}
            copiedTag={copiedTag()}
            onClose={() => setSelectedTag(null)}
            onCheckout={handleCheckoutTag}
            onPush={handlePushTag}
            onDelete={(tag) => setShowDeleteConfirm(tag)}
            onCreateBranch={(tag) => {
              setNewBranchName(`branch-from-${tag.name}`);
              setShowBranchDialog(tag);
            }}
            onCopyToClipboard={copyToClipboard}
            formatDate={formatDate}
          />
        </Show>
      </div>

      <Show when={showCreateDialog()}>
        <CreateTagDialog
          repoPath={props.repoPath}
          onCreated={handleTagCreated}
          onCancel={() => setShowCreateDialog(false)}
        />
      </Show>

      <DeleteTagModal
        tag={showDeleteConfirm()}
        deleteRemoteToo={deleteRemoteToo()}
        operationLoading={operationLoading()}
        onClose={() => { setShowDeleteConfirm(null); setDeleteRemoteToo(false); }}
        onDelete={handleDeleteTag}
        onDeleteRemoteToggle={setDeleteRemoteToo}
      />

      <CreateBranchModal
        tag={showBranchDialog()}
        branchName={newBranchName()}
        operationLoading={operationLoading()}
        onClose={() => { setShowBranchDialog(null); setNewBranchName(""); }}
        onCreateBranch={handleCreateBranchFromTag}
        onBranchNameChange={setNewBranchName}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default TagManager;
