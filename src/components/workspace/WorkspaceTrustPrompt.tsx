import { createSignal, onMount, onCleanup, For, Show, JSX } from "solid-js";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useWorkspace } from "@/context/WorkspaceContext";

const iconContainerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "48px",
  height: "48px",
  "border-radius": "var(--cortex-radius-full)",
  background: "var(--cortex-warning-bg, rgba(251, 191, 36, 0.15))",
  margin: "0 auto 16px",
  "flex-shrink": "0",
};

const warningTextStyle: JSX.CSSProperties = {
  "font-size": "13px",
  "line-height": "1.5",
  color: "var(--cortex-text-secondary, var(--jb-text-muted-color))",
  "margin-bottom": "16px",
};

const folderListContainerStyle: JSX.CSSProperties = {
  "margin-bottom": "16px",
};

const folderListLabelStyle: JSX.CSSProperties = {
  "font-size": "12px",
  "font-weight": "600",
  color: "var(--cortex-text-primary)",
  "margin-bottom": "8px",
  "text-transform": "uppercase",
  "letter-spacing": "0.5px",
};

const folderListStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
  padding: "8px 12px",
  background: "var(--cortex-bg-secondary, rgba(255, 255, 255, 0.05))",
  "border-radius": "var(--cortex-radius-md)",
  border: "1px solid var(--cortex-border-default)",
  "max-height": "120px",
  "overflow-y": "auto",
};

const folderItemStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "font-size": "12px",
  color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-mono, monospace)",
  "word-break": "break-all",
};

const restrictedSectionStyle: JSX.CSSProperties = {
  padding: "12px",
  background: "var(--cortex-warning-bg, rgba(251, 191, 36, 0.08))",
  "border-radius": "var(--cortex-radius-md)",
  border: "1px solid var(--cortex-warning, rgba(251, 191, 36, 0.3))",
};

const restrictedTitleStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
  "font-size": "12px",
  "font-weight": "600",
  color: "var(--cortex-warning, #fbbf24)",
  "margin-bottom": "8px",
};

const restrictedListStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
  "padding-left": "20px",
  margin: "0",
  "font-size": "12px",
  "line-height": "1.5",
  color: "var(--cortex-text-secondary, var(--jb-text-muted-color))",
};

const RESTRICTIONS = [
  "Extensions will be disabled",
  "Tasks and debugging will not run",
  "Workspace settings will be ignored",
  "Code execution will be restricted",
];

export function WorkspaceTrustPrompt() {
  const [open, setOpen] = createSignal(false);
  const workspace = useWorkspace();

  const handleTrustPrompt = () => {
    setOpen(true);
  };

  onMount(() => {
    window.addEventListener("workspace:trust-prompt", handleTrustPrompt);
  });

  onCleanup(() => {
    window.removeEventListener("workspace:trust-prompt", handleTrustPrompt);
  });

  const handleTrust = () => {
    workspace.trustWorkspace();
    setOpen(false);
  };

  const handleDontTrust = () => {
    setOpen(false);
  };

  const folders = () => workspace.folders();

  const footer = (
    <>
      <Button variant="secondary" onClick={handleDontTrust}>
        Don't Trust
      </Button>
      <Button variant="primary" onClick={handleTrust}>
        <Icon name="shield-check" size={14} />
        Trust Workspace
      </Button>
    </>
  );

  return (
    <Modal
      open={open()}
      onClose={handleDontTrust}
      title="Do You Trust the Authors of This Workspace?"
      size="md"
      footer={footer}
    >
      <div style={{ "text-align": "center" }}>
        <div style={iconContainerStyle}>
          <Icon name="shield-exclamation" size={24} style={{ color: "var(--cortex-warning, #fbbf24)" }} />
        </div>
      </div>

      <Text as="p" size="sm" style={warningTextStyle}>
        Trusting a workspace grants its contents the ability to execute code,
        run tasks, and use extensions without restrictions. Only trust workspaces
        from sources you know and trust.
      </Text>

      <Show when={folders().length > 0}>
        <div style={folderListContainerStyle}>
          <div style={folderListLabelStyle}>Workspace Folders</div>
          <div style={folderListStyle}>
            <For each={folders()}>
              {(folder) => (
                <div style={folderItemStyle}>
                  <Icon name="folder" size={14} style={{ "flex-shrink": "0", color: "var(--cortex-text-muted)" }} />
                  <span>{folder.path}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div style={restrictedSectionStyle}>
        <div style={restrictedTitleStyle}>
          <Icon name="triangle-exclamation" size={12} />
          Untrusted workspaces have limited functionality
        </div>
        <ul style={restrictedListStyle}>
          <For each={RESTRICTIONS}>
            {(restriction) => <li>{restriction}</li>}
          </For>
        </ul>
      </div>
    </Modal>
  );
}
