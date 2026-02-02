import { Component, createSignal, For, Show } from "solid-js";
import { useExtensions, type Extension as ContextExtension } from "@/context/ExtensionsContext";

interface DisplayExtension {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  enabled: boolean;
  hasUpdate?: boolean;
  newVersion?: string;
}

type TabType = "installed" | "recommended" | "outdated";

export const CortexExtensionsPanel: Component = () => {
  let extensions: ReturnType<typeof useExtensions> | null = null;
  try {
    extensions = useExtensions();
  } catch {
    // Context not available
  }

  const [activeTab, setActiveTab] = createSignal<TabType>("installed");
  const [searchQuery, setSearchQuery] = createSignal("");

  // Map real extensions to our format
  const installedExtensions = (): DisplayExtension[] => {
    const exts = extensions?.extensions() || [];
    return exts.map((ext: ContextExtension) => ({
      id: ext.manifest.name,
      name: ext.manifest.name,
      author: ext.manifest.author || "Unknown",
      description: ext.manifest.description || "",
      version: ext.manifest.version || "1.0.0",
      enabled: ext.enabled ?? true,
      hasUpdate: extensions?.outdatedExtensions?.().has(ext.manifest.name),
      newVersion: extensions?.outdatedExtensions?.().get(ext.manifest.name)?.availableVersion,
    }));
  };

  const outdatedExtensions = (): DisplayExtension[] => {
    return installedExtensions().filter(ext => ext.hasUpdate);
  };

  const recommendedExtensions = (): DisplayExtension[] => [
    { id: "prettier", name: "Prettier", author: "Prettier", description: "Code formatter", version: "3.0.0", enabled: false },
    { id: "eslint", name: "ESLint", author: "Microsoft", description: "Linting for JavaScript/TypeScript", version: "2.4.0", enabled: false },
    { id: "gitlens", name: "GitLens", author: "GitKraken", description: "Git supercharged", version: "14.0.0", enabled: false },
  ];

  const currentExtensions = () => {
    const query = searchQuery().toLowerCase();
    let list: DisplayExtension[] = [];
    
    switch (activeTab()) {
      case "installed": list = installedExtensions(); break;
      case "recommended": list = recommendedExtensions(); break;
      case "outdated": list = outdatedExtensions(); break;
    }
    
    if (query) {
      list = list.filter(ext => 
        ext.name.toLowerCase().includes(query) ||
        ext.description.toLowerCase().includes(query)
      );
    }
    
    return list;
  };

  const handleToggle = (ext: DisplayExtension) => {
    if (ext.enabled) {
      extensions?.disableExtension?.(ext.id);
    } else {
      extensions?.enableExtension?.(ext.id);
    }
  };

  const handleUninstall = (ext: DisplayExtension) => {
    extensions?.uninstallExtension?.(ext.id);
  };

  const handleUpdate = (ext: DisplayExtension) => {
    extensions?.updateExtension?.(ext.id);
  };

  const handleInstall = (ext: DisplayExtension) => {
    extensions?.installFromMarketplace?.(ext.id);
  };

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      height: "100%",
      background: "var(--cortex-bg-secondary)",
      color: "var(--cortex-text-primary)",
      "font-family": "'SF Pro Text', -apple-system, sans-serif",
      "font-size": "13px",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        "border-bottom": "1px solid var(--cortex-bg-hover)",
      }}>
        <span style={{ "font-weight": "500" }}>Extensions</span>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search extensions..."
            style={{
              width: "100%",
              background: "var(--cortex-bg-primary)",
              border: "1px solid var(--cortex-bg-hover)",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-primary)",
              padding: "8px 8px 8px 32px",
              "font-size": "13px",
              outline: "none",
            }}
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="var(--cortex-text-inactive)"
            style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}
          >
            <path d="M11.7 10.3c.9-1.2 1.4-2.6 1.4-4.2 0-3.9-3.1-7-7-7S-.1 2.2-.1 6.1s3.1 7 7 7c1.6 0 3.1-.5 4.2-1.4l3.8 3.8.7-.7-3.9-3.5zM6.9 12c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
          </svg>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        "border-bottom": "1px solid var(--cortex-bg-hover)",
      }}>
        <Tab
          label="Installed"
          count={installedExtensions().length}
          active={activeTab() === "installed"}
          onClick={() => setActiveTab("installed")}
        />
        <Tab
          label="Recommended"
          active={activeTab() === "recommended"}
          onClick={() => setActiveTab("recommended")}
        />
        <Tab
          label="Outdated"
          count={outdatedExtensions().length}
          active={activeTab() === "outdated"}
          onClick={() => setActiveTab("outdated")}
          highlight={outdatedExtensions().length > 0}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <Show when={extensions?.loading?.()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>
            Loading...
          </div>
        </Show>

        <Show when={!extensions?.loading?.() && currentExtensions().length === 0}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>
            <Show when={activeTab() === "installed"}>No extensions installed</Show>
            <Show when={activeTab() === "recommended"}>No recommendations</Show>
            <Show when={activeTab() === "outdated"}>All extensions up to date</Show>
          </div>
        </Show>

        <For each={currentExtensions()}>
          {(ext) => (
            <ExtensionCard
              extension={ext}
              isInstalled={activeTab() !== "recommended"}
              onToggle={() => handleToggle(ext)}
              onUninstall={() => handleUninstall(ext)}
              onUpdate={() => handleUpdate(ext)}
              onInstall={() => handleInstall(ext)}
            />
          )}
        </For>
      </div>

      {/* Footer */}
      <div style={{
        padding: "8px 16px",
        "border-top": "1px solid var(--cortex-bg-hover)",
        display: "flex",
        "justify-content": "space-between",
        "align-items": "center",
      }}>
        <button
          onClick={() => extensions?.checkForUpdates?.()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cortex-text-inactive)",
            cursor: "pointer",
            padding: "4px 8px",
            "font-size": "12px",
            display: "flex",
            "align-items": "center",
            gap: "4px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 2a.5.5 0 0 0-.5.5V5a5 5 0 1 0-1.07 5.5.5.5 0 0 0-.76-.65A4 4 0 1 1 12 5.5H9.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z"/>
          </svg>
          Check for updates
        </button>
        <button
          onClick={() => extensions?.openExtensionsDirectory?.()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cortex-text-inactive)",
            cursor: "pointer",
            padding: "4px 8px",
            "font-size": "12px",
          }}
        >
          Open folder
        </button>
      </div>
    </div>
  );
};

interface TabProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}

const Tab: Component<TabProps> = (props) => (
  <button
    onClick={props.onClick}
    style={{
      flex: 1,
      background: "transparent",
      border: "none",
      "border-bottom": props.active ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
      color: props.active ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
      padding: "10px 8px",
      cursor: "pointer",
      "font-size": "12px",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      gap: "6px",
    }}
  >
    {props.label}
    <Show when={props.count !== undefined && props.count > 0}>
      <span style={{
        background: props.highlight ? "var(--cortex-accent-primary)" : "var(--cortex-bg-hover)",
        color: props.highlight ? "var(--cortex-bg-secondary)" : "var(--cortex-text-inactive)",
        padding: "2px 6px",
        "border-radius": "var(--cortex-radius-lg)",
        "font-size": "10px",
        "font-weight": "600",
      }}>
        {props.count}
      </span>
    </Show>
  </button>
);

interface ExtensionCardProps {
  extension: DisplayExtension;
  isInstalled: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  onInstall: () => void;
}

const ExtensionCard: Component<ExtensionCardProps> = (props) => (
  <div
    style={{
      padding: "12px 16px",
      "border-bottom": "1px solid var(--cortex-bg-hover)",
      display: "flex",
      gap: "12px",
    }}
    class="ext-card"
  >
    {/* Icon placeholder */}
    <div style={{
      width: "48px",
      height: "48px",
      background: "var(--cortex-bg-hover)",
      "border-radius": "var(--cortex-radius-md)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "flex-shrink": 0,
    }}>
      <svg width="24" height="24" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)">
        <path d="M14.773 3.485l-.78-.184-2.108 2.096-1.194-1.216 2.056-2.157-.18-.792a4.42 4.42 0 0 0-1.347-.228 3.64 3.64 0 0 0-1.457.28 3.824 3.824 0 0 0-1.186.84 3.736 3.736 0 0 0-.875 1.265 3.938 3.938 0 0 0 0 2.926 3.985 3.985 0 0 0 .057.122L3.022 11.27a.997.997 0 0 0-.26.447L2 14.5l2.726-.746a.997.997 0 0 0 .447-.26l4.665-4.665c.04.019.08.038.122.057a3.938 3.938 0 0 0 2.926 0 3.736 3.736 0 0 0 1.265-.875 3.824 3.824 0 0 0 .84-1.186 3.64 3.64 0 0 0 .28-1.457 4.42 4.42 0 0 0-.228-1.347l-.27-.536z"/>
      </svg>
    </div>

    {/* Info */}
    <div style={{ flex: 1, "min-width": 0 }}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" }}>
        <span style={{ "font-weight": "500" }}>{props.extension.name}</span>
        <span style={{ color: "var(--cortex-text-inactive)", "font-size": "11px" }}>v{props.extension.version}</span>
        <Show when={props.extension.hasUpdate}>
          <span style={{
            background: "var(--cortex-accent-primary)",
            color: "var(--cortex-accent-text)",
            padding: "2px 6px",
            "border-radius": "var(--cortex-radius-lg)",
            "font-size": "10px",
            "font-weight": "600",
          }}>
            {props.extension.newVersion}
          </span>
        </Show>
      </div>
      <div style={{ color: "var(--cortex-text-inactive)", "font-size": "12px", "margin-bottom": "4px" }}>
        {props.extension.author}
      </div>
      <div style={{
        color: "var(--cortex-text-inactive)",
        "font-size": "12px",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.extension.description}
      </div>
    </div>

    {/* Actions */}
    <div style={{ display: "flex", "flex-direction": "column", gap: "4px", "align-items": "flex-end" }}>
      <Show when={props.isInstalled}>
        <Show when={props.extension.hasUpdate}>
          <button onClick={props.onUpdate} style={updateBtnStyle}>Update</button>
        </Show>
        <button
          onClick={props.onToggle}
          style={{
            ...actionBtnStyle,
            background: props.extension.enabled ? "var(--cortex-bg-hover)" : "transparent",
            border: props.extension.enabled ? "none" : "1px solid var(--cortex-bg-hover)",
          }}
        >
          {props.extension.enabled ? "Disable" : "Enable"}
        </button>
        <button onClick={props.onUninstall} style={{ ...actionBtnStyle, color: "var(--cortex-error)" }}>
          Uninstall
        </button>
      </Show>
      <Show when={!props.isInstalled}>
        <button onClick={props.onInstall} style={updateBtnStyle}>Install</button>
      </Show>
    </div>

    <style>{`.ext-card:hover { background: rgba(255,255,255,0.02); }`}</style>
  </div>
);

const actionBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--cortex-text-inactive)",
  cursor: "pointer",
  padding: "4px 8px",
  "font-size": "11px",
  "border-radius": "var(--cortex-radius-sm)",
};

const updateBtnStyle = {
  background: "var(--cortex-accent-primary)",
  border: "none",
  color: "var(--cortex-accent-text)",
  cursor: "pointer",
  padding: "4px 12px",
  "font-size": "11px",
  "font-weight": "500",
  "border-radius": "var(--cortex-radius-sm)",
};

export default CortexExtensionsPanel;


