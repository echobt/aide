import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useNotebook } from "@/context/NotebookContext";
import type { KernelStatus } from "@/context/NotebookContext";
import { KernelPicker } from "@/components/notebook/KernelPicker";

function kernelStatusColor(status: KernelStatus): string {
  switch (status) {
    case "idle":
      return "var(--success)";
    case "busy":
      return "var(--warning)";
    case "starting":
    case "restarting":
      return "var(--cortex-info)";
    case "error":
      return "var(--error)";
    case "disconnected":
      return "var(--text-weaker)";
  }
}

interface ToolbarButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  iconColor?: string;
}

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      onClick={() => props.onClick()}
      disabled={props.disabled}
      class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title={props.title}
    >
      <Icon
        name={props.icon}
        class="w-4 h-4"
        style={{ color: props.iconColor || "var(--text-weak)" }}
      />
    </button>
  );
}

export function NotebookToolbar() {
  const notebook = useNotebook();

  const status = (): KernelStatus => notebook.getKernelStatus();
  const isRunning = () => notebook.isExecuting();

  const activeNotebook = () => notebook.getActiveNotebook();

  const cellCount = () => {
    const nb = activeNotebook();
    return nb?.notebook.cells.length || 0;
  };

  const handleRunAll = async () => {
    await notebook.executeAllCells();
  };

  const handleRestartKernel = async () => {
    await notebook.restartKernel();
  };

  const handleRestartAndRunAll = async () => {
    await notebook.restartKernel(true);
  };

  const handleInterruptKernel = async () => {
    await notebook.interruptKernel();
  };

  const handleClearOutputs = () => {
    notebook.clearOutputs();
  };

  const handleSave = async () => {
    await notebook.saveNotebook();
  };

  const handleExportScript = () => {
    notebook.exportToScript();
  };

  return (
    <div
      class="notebook-toolbar flex items-center gap-1 px-3 py-1.5 shrink-0"
      style={{
        background: "var(--surface-base)",
        "border-bottom": "1px solid var(--border-base)",
      }}
    >
      <ToolbarButton
        icon="floppy-disk"
        title="Save notebook"
        onClick={handleSave}
      />

      <div
        class="mx-1"
        style={{ width: "1px", height: "20px", background: "var(--border-base)" }}
      />

      <ToolbarButton
        icon="play"
        title="Run all cells"
        onClick={handleRunAll}
        iconColor="var(--success)"
      />

      <ToolbarButton
        icon="forward-step"
        title="Interrupt kernel"
        onClick={handleInterruptKernel}
        disabled={!isRunning()}
        iconColor="var(--warning)"
      />

      <ToolbarButton
        icon="rotate-right"
        title="Restart kernel"
        onClick={handleRestartKernel}
      />

      <ToolbarButton
        icon="rotate-right"
        title="Restart kernel and run all"
        onClick={handleRestartAndRunAll}
        iconColor="var(--success)"
      />

      <div
        class="mx-1"
        style={{ width: "1px", height: "20px", background: "var(--border-base)" }}
      />

      <ToolbarButton
        icon="eraser"
        title="Clear all outputs"
        onClick={handleClearOutputs}
      />

      <ToolbarButton
        icon="file-export"
        title="Export as script"
        onClick={handleExportScript}
      />

      <div class="flex-1" />

      <div class="text-xs mr-2" style={{ color: "var(--text-weak)" }}>
        {cellCount()} cell{cellCount() !== 1 ? "s" : ""}
      </div>

      <Show when={isRunning()}>
        <div class="flex items-center gap-1 mr-2">
          <Icon
            name="spinner"
            class="w-3 h-3 animate-spin"
            style={{ color: kernelStatusColor(status()) }}
          />
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            Running
          </span>
        </div>
      </Show>

      <KernelPicker />
    </div>
  );
}
