import type { JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { TaskRun, BackgroundTaskStatus } from "@/context/TasksContext";

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
}

export function getStatusIcon(status: TaskRun["status"]): JSX.Element {
  switch (status) {
    case "running": return <Icon name="play" class="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
    case "completed": return <Icon name="check" class="w-3.5 h-3.5 text-green-400" />;
    case "failed": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
    case "cancelled": return <Icon name="stop" class="w-3.5 h-3.5 text-yellow-400" />;
    default: return <Icon name="clock" class="w-3.5 h-3.5 text-gray-400" />;
  }
}

export function getBackgroundStatusIcon(status: BackgroundTaskStatus | undefined): JSX.Element {
  switch (status) {
    case "watching": return <Icon name="eye" class="w-3.5 h-3.5 text-green-400" />;
    case "compiling": return <Icon name="spinner" class="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    case "idle": return <Icon name="pause" class="w-3.5 h-3.5 text-gray-400" />;
    case "error": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
    default: return <Icon name="eye" class="w-3.5 h-3.5 text-gray-400" />;
  }
}

export function getBackgroundStatusText(status: BackgroundTaskStatus | undefined): string {
  switch (status) {
    case "watching": return "Watching...";
    case "compiling": return "Compiling...";
    case "idle": return "Idle";
    case "error": return "Error";
    default: return "Running";
  }
}
