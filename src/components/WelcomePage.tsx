import { createSignal, Show, For, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { useRecentProjects, type RecentProject } from "@/context/RecentProjectsContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCommands } from "@/context/CommandContext";
import {
  isWalkthroughCompleted,
  getWalkthroughProgress,
  showWalkthrough,
  BUILTIN_WALKTHROUGHS,
  type WalkthroughData,
} from "./Walkthrough";
import { Button, Card, Text, Badge } from "@/components/ui";

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  showOnStartup: "welcome_show_on_startup",
  showQuickActions: "welcome_show_quick_actions",
  showGettingStarted: "welcome_show_getting_started",
  showWalkthroughs: "welcome_show_walkthroughs",
  showRecentProjects: "welcome_show_recent_projects",
  viewMode: "welcome_view_mode",
} as const;

const QUICK_LINKS = {
  documentation: "https://docs.cortex.dev/getting-started",
  shortcuts: "cortex://settings/keybindings",
  themes: "cortex://settings/themes",
  extensions: "cortex://settings/extensions",
};

// ============================================================================
// Types
// ============================================================================

type ViewMode = "grid" | "list";

interface WelcomePageSettings {
  showOnStartup: boolean;
  showQuickActions: boolean;
  showGettingStarted: boolean;
  showWalkthroughs: boolean;
  showRecentProjects: boolean;
  viewMode: ViewMode;
}

interface WelcomePageProps {
  onClose?: () => void;
  onNewFile?: () => void;
  onOpenFolder?: () => void;
  onCloneRepository?: () => void;
  onOpenSettings?: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function loadSettings(): WelcomePageSettings {
  return {
    showOnStartup: localStorage.getItem(STORAGE_KEYS.showOnStartup) !== "false",
    showQuickActions: localStorage.getItem(STORAGE_KEYS.showQuickActions) !== "false",
    showGettingStarted: localStorage.getItem(STORAGE_KEYS.showGettingStarted) !== "false",
    showWalkthroughs: localStorage.getItem(STORAGE_KEYS.showWalkthroughs) !== "false",
    showRecentProjects: localStorage.getItem(STORAGE_KEYS.showRecentProjects) !== "false",
    viewMode: (localStorage.getItem(STORAGE_KEYS.viewMode) as ViewMode) || "grid",
  };
}

function saveSettings(settings: WelcomePageSettings): void {
  localStorage.setItem(STORAGE_KEYS.showOnStartup, settings.showOnStartup.toString());
  localStorage.setItem(STORAGE_KEYS.showQuickActions, settings.showQuickActions.toString());
  localStorage.setItem(STORAGE_KEYS.showGettingStarted, settings.showGettingStarted.toString());
  localStorage.setItem(STORAGE_KEYS.showWalkthroughs, settings.showWalkthroughs.toString());
  localStorage.setItem(STORAGE_KEYS.showRecentProjects, settings.showRecentProjects.toString());
  localStorage.setItem(STORAGE_KEYS.viewMode, settings.viewMode);
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

function formatPath(path: string, maxLength: number = 50): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return normalized;

  return "~/" + parts.slice(-2).join("/");
}

function getProjectInitials(name: string): string {
  const words = name.split(/[-_\s]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getProjectColor(name: string): string {
  // Use CSS variable references for semantic colors
  const colors = [
    "var(--cortex-syntax-red)",      // Red
    "var(--cortex-syntax-yellow)",   // Yellow
    "var(--cortex-syntax-green)",    // Green
    "var(--cortex-syntax-blue)",     // Blue
    "var(--cortex-syntax-purple)",   // Purple
    "var(--cortex-syntax-cyan)",     // Cyan
    "var(--cortex-syntax-keyword)",  // Orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================================
// Logo Component
// ============================================================================

function CortexLogo() {
  return (
    <div class="flex items-center gap-3">
      <div
        class="flex items-center justify-center rounded-xl"
        style={{
          width: "56px",
          height: "56px",
          background: "linear-gradient(135deg, var(--cortex-primary) 0%, var(--cortex-syntax-purple) 100%)",
          "box-shadow": "0 4px 24px var(--cortex-accent-muted)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2 17L12 22L22 17"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2 12L12 17L22 12"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div>
        <Text
          as="h1"
          size="lg"
          weight="semibold"
          style={{ "font-size": "var(--jb-text-header-size)" }}
        >
          Cortex
        </Text>
        <Text variant="muted" size="sm" style={{ "margin-top": "-2px" }}>
          AI-Native Code Editor
        </Text>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Action Button Component
// ============================================================================

interface QuickActionProps {
  icon: string;
  label: string;
  description?: string;
  shortcut?: string;
  onClick: () => void;
}

function QuickActionButton(props: QuickActionProps) {
  return (
    <Card
      variant="outlined"
      padding="sm"
      hoverable
      onClick={props.onClick}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        width: "100%",
        padding: "12px",
        border: "1px solid var(--jb-border-default)",
        transition: "all 150ms ease",
      }}
    >
      <div
        class="flex items-center justify-center rounded-lg shrink-0"
        style={{
          width: "36px",
          height: "36px",
          background: "var(--jb-canvas)",
        }}
      >
        <Icon
          name={props.icon}
          class="w-4 h-4"
          style={{ color: "var(--cortex-primary)" }}
        />
      </div>
      <div class="flex-1 text-left min-w-0">
        <div class="flex items-center gap-2">
          <Text weight="medium" size="sm">
            {props.label}
          </Text>
          <Show when={props.shortcut}>
            <Badge variant="default" size="sm">
              {props.shortcut}
            </Badge>
          </Show>
        </div>
        <Show when={props.description}>
          <Text variant="muted" size="xs" truncate style={{ "margin-top": "2px" }}>
            {props.description}
          </Text>
        </Show>
      </div>
      <Icon
        name="chevron-right"
        class="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--jb-text-muted-color)" }}
      />
    </Card>
  );
}

// ============================================================================
// Getting Started Link Component
// ============================================================================

interface GettingStartedLinkProps {
  icon: string;
  label: string;
  href: string;
  external?: boolean;
  onClick?: () => void;
}

function GettingStartedLink(props: GettingStartedLinkProps) {
  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
    } else if (props.href.startsWith("cortex://")) {
      const action = props.href.replace("cortex://", "");
      window.dispatchEvent(new CustomEvent("cortex:navigate", { detail: { action } }));
    } else if (props.external) {
      window.open(props.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "8px 12px",
        width: "100%",
        "justify-content": "flex-start",
        color: "var(--jb-text-body-color)",
      }}
    >
      <Icon name={props.icon} class="w-4 h-4 shrink-0" style={{ color: "var(--cortex-primary)" }} />
      <Text size="sm" style={{ flex: "1" }}>{props.label}</Text>
      <Show when={props.external}>
        <Icon name="arrow-up-right-from-square" class="w-3 h-3 shrink-0" style={{ opacity: "0.5", color: "var(--jb-text-muted-color)" }} />
      </Show>
    </Button>
  );
}

// ============================================================================
// Walkthrough Card Component (for Welcome Page)
// ============================================================================

interface WelcomeWalkthroughCardProps {
  walkthrough: WalkthroughData;
  onClick: () => void;
}

function WelcomeWalkthroughCard(props: WelcomeWalkthroughCardProps) {
  const isCompleted = () => isWalkthroughCompleted(props.walkthrough.id);
  const progress = () => getWalkthroughProgress(props.walkthrough.id, props.walkthrough.steps.length);

  return (
    <Card
      variant="outlined"
      padding="sm"
      hoverable
      onClick={props.onClick}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        width: "100%",
        padding: "12px",
        border: "1px solid var(--jb-border-default)",
        transition: "all 150ms ease",
      }}
    >
      {/* Icon */}
      <div
        class="flex items-center justify-center rounded-lg shrink-0"
        style={{
          width: "36px",
          height: "36px",
          background: isCompleted()
            ? "color-mix(in srgb, var(--cortex-success) 15%, transparent)"
            : "var(--jb-app-root)",
        }}
      >
        <Show when={isCompleted()} fallback={
          <Icon name={props.walkthrough.icon} class="w-4 h-4" style={{ color: "var(--cortex-primary)" }} />
        }>
          <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 text-left min-w-0">
        <div class="flex items-center gap-2">
          <Text weight="medium" size="sm" truncate>
            {props.walkthrough.title}
          </Text>
          <Show when={isCompleted()}>
            <Badge variant="success" size="sm">
              Done
            </Badge>
          </Show>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <Text variant="muted" size="xs">
            {props.walkthrough.steps.length} steps
          </Text>
          <Show when={progress() > 0 && !isCompleted()}>
            <Text size="xs" color="primary">
              {progress()}%
            </Text>
          </Show>
        </div>
      </div>

      {/* Play/Arrow Icon */}
      <Show
        when={!isCompleted()}
        fallback={
          <Icon
            name="chevron-right"
            class="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--jb-text-muted-color)" }}
          />
        }
      >
        <Icon
          name="play"
          class="w-4 h-4 shrink-0"
          style={{ color: "var(--cortex-primary)" }}
        />
      </Show>
    </Card>
  );
}

// ============================================================================
// Project Card Component (Grid View)
// ============================================================================

interface ProjectCardProps {
  project: RecentProject;
  onOpen: () => void;
  onRemove: () => void;
  onTogglePin: () => void;
}

function ProjectCard(props: ProjectCardProps) {
  const [hovered, setHovered] = createSignal(false);

  return (
    <Card
      variant="outlined"
      padding="none"
      hoverable
      onClick={props.onOpen}
      style={{
        overflow: "hidden",
        border: "1px solid var(--jb-border-default)",
        transition: "all 150ms ease",
      }}
      class="group relative"
    >
      {/* Project Icon/Initials */}
      <div
        class="h-24 flex items-center justify-center relative"
        style={{
          background: `linear-gradient(135deg, ${getProjectColor(props.project.name)}15 0%, ${getProjectColor(props.project.name)}05 100%)`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Text
          weight="bold"
          style={{ "font-size": "1.5rem", color: getProjectColor(props.project.name) }}
        >
          {getProjectInitials(props.project.name)}
        </Text>

        {/* Pin indicator */}
        <Show when={props.project.pinned}>
          <div
            class="absolute top-2 left-2"
            title="Pinned"
          >
            <Icon
              name="star"
              class="w-3.5 h-3.5"
              style={{ color: "var(--cortex-primary)" }}
            />
          </div>
        </Show>

        {/* Action buttons - visible on hover */}
        <Show when={hovered()}>
          <div
            class="absolute top-2 right-2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onTogglePin}
              title={props.project.pinned ? "Unpin" : "Pin"}
              style={{
                padding: "6px",
                color: props.project.pinned ? "var(--cortex-primary)" : "var(--jb-text-muted-color)",
                background: "var(--jb-panel)",
              }}
            >
              <Icon name="star" class="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onRemove}
              title="Remove from recent"
              style={{
                padding: "6px",
                color: "var(--jb-text-muted-color)",
                background: "var(--jb-panel)",
              }}
            >
              <Icon name="trash" class="w-3.5 h-3.5" />
            </Button>
          </div>
        </Show>
      </div>

      {/* Project Info */}
      <div style={{ padding: "12px" }}>
        <Text weight="medium" size="sm" truncate style={{ display: "block" }}>
          <span title={props.project.name}>{props.project.name}</span>
        </Text>
        <Text
          variant="muted"
          size="xs"
          truncate
          style={{ "margin-top": "4px", display: "block" }}
        >
          <span title={props.project.path}>{formatPath(props.project.path, 35)}</span>
        </Text>
        <div
          class="flex items-center gap-1 mt-2"
          style={{ color: "var(--jb-text-muted-color)" }}
        >
          <Icon name="clock" class="w-3 h-3" />
          <Text variant="muted" size="xs">{formatRelativeTime(props.project.lastOpened)}</Text>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Project List Item Component (List View)
// ============================================================================

interface ProjectListItemProps {
  project: RecentProject;
  onOpen: () => void;
  onRemove: () => void;
  onTogglePin: () => void;
}

function ProjectListItem(props: ProjectListItemProps) {
  return (
    <div
      class="group flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
      style={{ "border-bottom": "1px solid var(--jb-border-default)" }}
      onClick={props.onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--jb-surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Project Icon */}
      <div
        class="flex items-center justify-center rounded-lg shrink-0"
        style={{
          width: "40px",
          height: "40px",
          background: `${getProjectColor(props.project.name)}15`,
        }}
      >
        <Text weight="semibold" size="sm" style={{ color: getProjectColor(props.project.name) }}>
          {getProjectInitials(props.project.name)}
        </Text>
      </div>

      {/* Project Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <Text weight="medium" size="sm" truncate>
            {props.project.name}
          </Text>
          <Show when={props.project.pinned}>
            <Icon
              name="star"
              class="w-3 h-3 shrink-0"
              style={{ color: "var(--cortex-primary)" }}
            />
          </Show>
        </div>
        <div class="flex items-center gap-3 mt-0.5">
          <Text variant="muted" size="xs" truncate>
            {formatPath(props.project.path)}
          </Text>
          <div
            class="flex items-center gap-1 shrink-0"
            style={{ color: "var(--jb-text-muted-color)" }}
          >
            <Icon name="clock" class="w-3 h-3" />
            <Text variant="muted" size="xs">
              {formatRelativeTime(props.project.lastOpened)}
            </Text>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onTogglePin}
          title={props.project.pinned ? "Unpin" : "Pin"}
          style={{
            padding: "6px",
            color: props.project.pinned ? "var(--cortex-primary)" : "var(--jb-text-muted-color)",
          }}
        >
          <Icon name="star" class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onRemove}
          title="Remove from recent"
          style={{
            padding: "6px",
            color: "var(--jb-text-muted-color)",
          }}
        >
          <Icon name="trash" class="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  visible: boolean;
  onToggleVisibility: () => void;
  children?: any;
}

function SectionHeader(props: SectionHeaderProps) {
  return (
    <div class="flex items-center justify-between mb-3">
      <Text variant="header">
        {props.title}
      </Text>
      <div class="flex items-center gap-2">
        {props.children}
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onToggleVisibility}
          title={props.visible ? "Hide section" : "Show section"}
          style={{
            padding: "4px",
            color: "var(--jb-text-muted-color)",
          }}
        >
          {props.visible ? (
            <Icon name="eye" class="w-3.5 h-3.5" />
          ) : (
            <Icon name="eye-slash" class="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyProjectsState(props: { onOpenFolder: () => void }) {
  return (
    <Card
      variant="outlined"
      padding="lg"
      style={{
        "text-align": "center",
        padding: "48px",
        border: "1px dashed var(--jb-border-default)",
      }}
    >
      <Icon
        name="folder"
        class="w-10 h-10 mx-auto mb-3"
        style={{ color: "var(--jb-text-muted-color)" }}
      />
      <Text weight="medium" size="sm" as="p">
        No recent projects
      </Text>
      <Text variant="muted" size="xs" as="p" style={{ "margin-top": "4px", "margin-bottom": "16px" }}>
        Open a folder to get started
      </Text>
      <Button variant="primary" onClick={props.onOpenFolder}>
        Open Folder
      </Button>
    </Card>
  );
}

// ============================================================================
// Main Welcome Page Component
// ============================================================================

export function WelcomePage(props: WelcomePageProps) {
  const recentProjects = useRecentProjects();
  const workspace = useWorkspace();
  const { registerCommand, unregisterCommand } = useCommands();

  const initialSettings = loadSettings();
  const [settings, setSettings] = createSignal<WelcomePageSettings>(initialSettings);
  const [isVisible, setIsVisible] = createSignal(true);

  // Save settings when they change
  createEffect(() => {
    saveSettings(settings());
  });

  // Register welcome page command
  onMount(() => {
    registerCommand({
      id: "welcome.show",
      label: "Welcome: Show Welcome Page",
      category: "Help",
      action: () => setIsVisible(true),
    });

    // Listen for show welcome page event
    const handleShowWelcome = () => setIsVisible(true);
    window.addEventListener("welcome:show", handleShowWelcome);

    onCleanup(() => {
      unregisterCommand("welcome.show");
      window.removeEventListener("welcome:show", handleShowWelcome);
    });
  });

  // Keyboard shortcut to close
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible()) {
        setIsVisible(false);
        props.onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const updateSetting = <K extends keyof WelcomePageSettings>(
    key: K,
    value: WelcomePageSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleNewFile = () => {
    if (props.onNewFile) {
      props.onNewFile();
    } else {
      window.dispatchEvent(new CustomEvent("file:new"));
    }
  };

  const handleOpenFolder = () => {
    if (props.onOpenFolder) {
      props.onOpenFolder();
    } else {
      window.dispatchEvent(new CustomEvent("folder:open"));
    }
  };

  const handleCloneRepository = () => {
    if (props.onCloneRepository) {
      props.onCloneRepository();
    } else {
      window.dispatchEvent(new CustomEvent("git:clone"));
    }
  };

  const handleOpenRecentProjects = () => {
    recentProjects.setShowRecentProjects(true);
  };

  const handleOpenSettings = () => {
    if (props.onOpenSettings) {
      props.onOpenSettings();
    } else {
      window.dispatchEvent(new CustomEvent("settings:open"));
    }
  };

  const handleOpenProject = (project: RecentProject) => {
    recentProjects.openProject(project);
  };

  const sortedProjects = () => {
    const pinned = recentProjects.pinnedProjects();
    const unpinned = recentProjects.unpinnedProjects();
    return [...pinned, ...unpinned];
  };

  const hasProjects = () => sortedProjects().length > 0;

  return (
    <Show when={isVisible()}>
      <div
        class="welcome-page h-full overflow-y-auto"
        style={{
          background: "var(--jb-canvas)",
        }}
      >
        <div
          class="max-w-4xl mx-auto px-6 py-12"
          style={{ "min-height": "100%" }}
        >
          {/* Header */}
          <div class="flex items-start justify-between mb-10">
            <CortexLogo />
            <div class="flex items-center gap-2">
              {/* Show on startup toggle */}
              <label
                class="flex items-center gap-2 cursor-pointer"
                style={{ color: "var(--jb-text-muted-color)" }}
              >
                <input
                  type="checkbox"
                  checked={settings().showOnStartup}
                  onChange={(e) => updateSetting("showOnStartup", e.currentTarget.checked)}
                  class="w-3.5 h-3.5 rounded"
                  style={{
                    "accent-color": "var(--cortex-primary)",
                    background: "var(--jb-app-root)",
                    border: "1px solid var(--jb-border-default)",
                  }}
                />
                <Text variant="muted" size="xs">Show on startup</Text>
              </label>
              <Show when={props.onClose}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsVisible(false);
                    props.onClose?.();
                  }}
                  title="Close (Escape)"
                  style={{
                    padding: "6px",
                    "margin-left": "8px",
                    color: "var(--jb-text-muted-color)",
                  }}
                >
                  <Icon name="xmark" class="w-4 h-4" />
                </Button>
              </Show>
            </div>
          </div>

          {/* Main Content Grid */}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Quick Actions & Getting Started */}
            <div class="lg:col-span-1 space-y-8">
              {/* Quick Actions Section */}
              <section>
                <SectionHeader
                  title="Quick Actions"
                  visible={settings().showQuickActions}
                  onToggleVisibility={() =>
                    updateSetting("showQuickActions", !settings().showQuickActions)
                  }
                />
                <Show when={settings().showQuickActions}>
                  <div class="space-y-2">
                    <QuickActionButton
                      icon="file"
                      label="New File"
                      description="Create a new untitled file"
                      shortcut="Ctrl+N"
                      onClick={handleNewFile}
                    />
                    <QuickActionButton
                      icon="folder"
                      label="Open Folder"
                      description="Open a local folder"
                      shortcut="Ctrl+O"
                      onClick={handleOpenFolder}
                    />
                    <QuickActionButton
                      icon="code-branch"
                      label="Clone Repository"
                      description="Clone a Git repository"
                      onClick={handleCloneRepository}
                    />
                    <QuickActionButton
                      icon="clock"
                      label="Open Recent"
                      description="Browse recent projects"
                      shortcut="Ctrl+Shift+E"
                      onClick={handleOpenRecentProjects}
                    />
                    <QuickActionButton
                      icon="gear"
                      label="Open Settings"
                      description="Configure your preferences"
                      shortcut="Ctrl+,"
                      onClick={handleOpenSettings}
                    />
                  </div>
                </Show>
              </section>

              {/* Getting Started Section */}
              <section>
                <SectionHeader
                  title="Getting Started"
                  visible={settings().showGettingStarted}
                  onToggleVisibility={() =>
                    updateSetting("showGettingStarted", !settings().showGettingStarted)
                  }
                />
                <Show when={settings().showGettingStarted}>
                  <Card
                    variant="outlined"
                    padding="none"
                    style={{
                      overflow: "hidden",
                      border: "1px solid var(--jb-border-default)",
                    }}
                  >
                    <GettingStartedLink
                      icon="book-open"
                      label="Learn the Basics"
                      href={QUICK_LINKS.documentation}
                      external
                    />
                    <GettingStartedLink
                      icon="terminal"
                      label="Keyboard Shortcuts"
                      href={QUICK_LINKS.shortcuts}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("settings:open", {
                          detail: { tab: "keybindings" },
                        }));
                      }}
                    />
                    <GettingStartedLink
                      icon="gear"
                      label="Theme Settings"
                      href={QUICK_LINKS.themes}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("settings:open", {
                          detail: { tab: "appearance" },
                        }));
                      }}
                    />
                    <GettingStartedLink
                      icon="grid-2"
                      label="Browse Extensions"
                      href={QUICK_LINKS.extensions}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("settings:open", {
                          detail: { tab: "extensions" },
                        }));
                      }}
                    />
                  </Card>
                </Show>
              </section>

              {/* Walkthroughs Section */}
              <section>
                <SectionHeader
                  title="Walkthroughs"
                  visible={settings().showWalkthroughs}
                  onToggleVisibility={() =>
                    updateSetting("showWalkthroughs", !settings().showWalkthroughs)
                  }
                />
                <Show when={settings().showWalkthroughs}>
                  <div class="space-y-2">
                    <For each={BUILTIN_WALKTHROUGHS}>
                      {(walkthrough) => (
                        <WelcomeWalkthroughCard
                          walkthrough={walkthrough}
                          onClick={() => showWalkthrough(walkthrough.id)}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              {/* Version Info */}
              <div
                class="text-center pt-4"
                style={{
                  "border-top": "1px solid var(--jb-border-default)",
                }}
              >
                <Text variant="muted" size="xs" as="p">Cortex Desktop v1.0.0</Text>
                <Text variant="muted" size="xs" as="p" style={{ "margin-top": "4px" }}>
                  <a
                    href="https://cortex.dev/changelog"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:underline"
                    style={{ color: "var(--cortex-primary)" }}
                  >
                    View Changelog
                  </a>
                </Text>
              </div>
            </div>

            {/* Right Column - Recent Workspaces & Projects */}
            <div class="lg:col-span-2 space-y-6">
              {/* Recent Workspaces Section */}
              <Show when={workspace.recentWorkspaces().length > 0}>
                <section>
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <Icon name="layer-group" class="w-4 h-4" style={{ color: "var(--cortex-primary)" }} />
                      <Text variant="header">
                        Recent Workspaces
                      </Text>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => workspace.clearRecentWorkspaces()}
                      style={{ color: "var(--jb-text-muted-color)" }}
                    >
                      Clear
                    </Button>
                  </div>
                  <Card
                    variant="outlined"
                    padding="none"
                    style={{
                      overflow: "hidden",
                      border: "1px solid var(--jb-border-default)",
                    }}
                  >
                    <For each={workspace.recentWorkspaces().slice(0, 5)}>
                      {(ws, index) => (
                        <div
                          class="group w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                          style={{
                            "border-top": index() > 0 ? "1px solid var(--jb-border-default)" : "none",
                          }}
                          onClick={() => workspace.openRecentWorkspace(ws)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--jb-surface-hover)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Show when={ws.isWorkspaceFile || ws.folderCount > 1} fallback={
                            <Icon name="folder" class="w-4 h-4 shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
                          }>
                            <Icon name="layer-group" class="w-4 h-4 shrink-0" style={{ color: "var(--cortex-primary)" }} />
                          </Show>
                          <div class="flex-1 min-w-0 text-left">
                            <div class="flex items-center gap-2">
                              <Text size="sm" truncate>
                                {ws.name}
                              </Text>
                              <Show when={ws.folderCount > 1}>
                                <Badge variant="default" size="sm">
                                  {ws.folderCount} folders
                                </Badge>
                              </Show>
                            </div>
                            <div class="flex items-center gap-2 mt-0.5">
                              <Text variant="muted" size="xs" truncate>
                                {ws.path.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                              </Text>
                            </div>
                          </div>
                          <div
                            class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => workspace.removeFromRecentWorkspaces(ws.id)}
                              title="Remove"
                              style={{
                                padding: "6px",
                                color: "var(--jb-text-muted-color)",
                              }}
                            >
                              <Icon name="trash" class="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </For>
                  </Card>
                </section>
              </Show>

              {/* Recent Projects Section */}
              <section>
                <SectionHeader
                  title="Recent Projects"
                  visible={settings().showRecentProjects}
                  onToggleVisibility={() =>
                    updateSetting("showRecentProjects", !settings().showRecentProjects)
                  }
                >
                  <Show when={hasProjects() && settings().showRecentProjects}>
                    <div class="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSetting("viewMode", "grid")}
                        title="Grid view"
                        style={{
                          padding: "4px",
                          color: settings().viewMode === "grid"
                            ? "var(--jb-text-body-color)"
                            : "var(--jb-text-muted-color)",
                          background: settings().viewMode === "grid"
                            ? "var(--jb-surface-active)"
                            : "transparent",
                        }}
                      >
                        <Icon name="grid-2" class="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSetting("viewMode", "list")}
                        title="List view"
                        style={{
                          padding: "4px",
                          color: settings().viewMode === "list"
                            ? "var(--jb-text-body-color)"
                            : "var(--jb-text-muted-color)",
                          background: settings().viewMode === "list"
                            ? "var(--jb-surface-active)"
                            : "transparent",
                        }}
                      >
                        <Icon name="list" class="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Show>
                </SectionHeader>

                <Show when={settings().showRecentProjects}>
                  <Show
                    when={hasProjects()}
                    fallback={<EmptyProjectsState onOpenFolder={handleOpenFolder} />}
                  >
                    {/* Grid View */}
                    <Show when={settings().viewMode === "grid"}>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <For each={sortedProjects().slice(0, 9)}>
                          {(project) => (
                            <ProjectCard
                              project={project}
                              onOpen={() => handleOpenProject(project)}
                              onRemove={() => recentProjects.removeProject(project.id)}
                              onTogglePin={() => recentProjects.togglePin(project.id)}
                            />
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* List View */}
                    <Show when={settings().viewMode === "list"}>
                      <Card
                        variant="outlined"
                        padding="none"
                        style={{
                          overflow: "hidden",
                          border: "1px solid var(--jb-border-default)",
                        }}
                      >
                        <For each={sortedProjects().slice(0, 10)}>
                          {(project) => (
                            <ProjectListItem
                              project={project}
                              onOpen={() => handleOpenProject(project)}
                              onRemove={() => recentProjects.removeProject(project.id)}
                              onTogglePin={() => recentProjects.togglePin(project.id)}
                            />
                          )}
                        </For>
                      </Card>
                    </Show>

                    {/* View All link */}
                    <Show when={sortedProjects().length > 9}>
                      <div class="mt-4 text-center">
                        <Button
                          variant="ghost"
                          onClick={handleOpenRecentProjects}
                          style={{ color: "var(--cortex-primary)" }}
                        >
                          View all {sortedProjects().length} projects →
                        </Button>
                      </div>
                    </Show>
                  </Show>
                </Show>
              </section>
            </div>
          </div>

          {/* Footer keyboard hint */}
          <div class="mt-12 text-center">
            <Text variant="muted" size="xs" as="p">
              Press{" "}
              <Badge variant="default" size="sm">
                Ctrl+Shift+P
              </Badge>{" "}
              to open the Command Palette
            </Text>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Utility Functions for External Use
// ============================================================================

/**
 * Check if welcome page should be shown on startup
 */
export function shouldShowWelcomeOnStartup(): boolean {
  const stored = localStorage.getItem(STORAGE_KEYS.showOnStartup);
  return stored !== "false";
}

/**
 * Set whether welcome page should be shown on startup
 */
export function setShowWelcomeOnStartup(show: boolean): void {
  localStorage.setItem(STORAGE_KEYS.showOnStartup, show.toString());
}

/**
 * Programmatically show the welcome page
 */
export function showWelcomePage(): void {
  window.dispatchEvent(new CustomEvent("welcome:show"));
}

/**
 * Get current welcome page settings
 */
export function getWelcomePageSettings(): WelcomePageSettings {
  return loadSettings();
}

/**
 * Update welcome page settings
 */
export function updateWelcomePageSettings(
  updates: Partial<WelcomePageSettings>
): void {
  const current = loadSettings();
  saveSettings({ ...current, ...updates });
}
