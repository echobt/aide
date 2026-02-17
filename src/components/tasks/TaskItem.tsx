import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";
import type { TaskConfig, RunOnSaveConfig } from "@/context/TasksContext";

export interface TaskItemProps {
  task: TaskConfig;
  onRun: () => void;
  onRunInTerminal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  subtitle?: string;
}

export function TaskItem(props: TaskItemProps) {
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "npm": return "📦";
      case "cargo": return "🦀";
      case "shell": return "💻";
      default: return "⚡";
    }
  };

  return (
    <div 
      class="flex items-center gap-3 px-4 py-2 mx-2 rounded hover:bg-[var(--surface-hover)] cursor-pointer group"
      onClick={props.onRun}
    >
      <span class="text-base">{getTaskTypeIcon(props.task.type)}</span>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
            {props.task.label}
          </span>
          <Show when={props.task.isDefault}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}>
              default
            </span>
          </Show>
          <Show when={props.task.isBackground}>
            <span class="text-[10px] px-1 rounded flex items-center gap-0.5" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
              <Icon name="eye" class="w-2.5 h-2.5" />
              watch
            </span>
          </Show>
          <Show when={props.task.source === "auto-detected"}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
              detected
            </span>
          </Show>
        </div>
        <Show when={props.subtitle}>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.subtitle}
          </div>
        </Show>
        <Show when={!props.subtitle && props.task.command}>
          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
            {props.task.command} {props.task.args?.join(" ")}
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          onClick={(e) => { e.stopPropagation(); props.onRun(); }}
          tooltip="Run"
          size="sm"
        >
          <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
        </IconButton>
        <IconButton
          onClick={(e) => { e.stopPropagation(); props.onRunInTerminal(); }}
          tooltip="Run in Terminal"
          size="sm"
        >
          <Icon name="terminal" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />
        </IconButton>
        <Show when={props.task.source === "user"}>
          <IconButton
            onClick={(e) => { e.stopPropagation(); props.onEdit(); }}
            tooltip="Edit"
            size="sm"
          >
            <Icon name="gear" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); props.onDelete(); }}
            tooltip="Delete"
            size="sm"
          >
            <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

export interface RunOnSaveItemProps {
  config: RunOnSaveConfig;
  taskLabel: string;
  onToggle: () => void;
  onDelete: () => void;
}

export function RunOnSaveItem(props: RunOnSaveItemProps) {
  return (
    <div 
      class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)] group"
      style={{ 
        "border-color": "var(--border-base)",
        opacity: props.config.enabled ? 1 : 0.6,
      }}
    >
      <IconButton
        onClick={props.onToggle}
        tooltip={props.config.enabled ? "Disable" : "Enable"}
        size="sm"
      >
        {props.config.enabled ? (
          <Icon name="toggle-on" class="w-5 h-5" style={{ color: "var(--cortex-success)" }} />
        ) : (
          <Icon name="toggle-off" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
        )}
      </IconButton>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
            {props.taskLabel}
          </span>
          <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
            {props.config.delay}ms
          </span>
        </div>
        <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
          <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>
            {props.config.globPattern}
          </code>
        </div>
      </div>

      <IconButton
        onClick={props.onDelete}
        tooltip="Delete"
        size="sm"
        style={{ opacity: 0 }}
        class="group-hover:opacity-100 transition-opacity"
      >
        <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
      </IconButton>
    </div>
  );
}
