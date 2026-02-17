import { Show, For, type JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton } from "@/components/ui";
import { TaskItem } from "@/components/tasks/TaskItem";
import type { TaskConfig, TaskRun, TaskGroup as TaskGroupType } from "@/context/TasksContext";

export interface TaskGroupSection {
  group: TaskGroupType;
  label: string;
  tasks: TaskConfig[];
}

interface RecentTaskEntry {
  taskLabel: string;
  lastRun: number;
  runCount: number;
  task: TaskConfig;
}

interface AllTasksTabProps {
  groupedTasks: TaskGroupSection[];
  recentTasks: RecentTaskEntry[];
  expandedGroups: Set<string>;
  toggleGroup: (group: string) => void;
  onRun: (task: TaskConfig) => void;
  onRunInTerminal: (task: TaskConfig) => void;
  onEdit: (task: TaskConfig) => void;
  onDelete: (task: TaskConfig) => void;
  onCreateTask: () => void;
  formatTime: (timestamp: number) => string;
  totalTasks: number;
}

export function AllTasksTab(props: AllTasksTabProps) {
  return (
    <>
      <Show when={props.recentTasks.length > 0}>
        <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
          <Button
            variant="ghost"
            style={{ width: "100%", "justify-content": "flex-start", "border-radius": "0" }}
            onClick={() => props.toggleGroup("recent")}
          >
            {props.expandedGroups.has("recent") ? (
              <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            ) : (
              <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            )}
            <Icon name="clock" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>Recent</span>
            <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
              {props.recentTasks.length}
            </span>
          </Button>
          
          <Show when={props.expandedGroups.has("recent")}>
            <div class="pb-2">
              <For each={props.recentTasks}>
                {(item) => (
                  <TaskItem
                    task={item.task}
                    onRun={() => props.onRun(item.task)}
                    onRunInTerminal={() => props.onRunInTerminal(item.task)}
                    onEdit={() => props.onEdit(item.task)}
                    onDelete={() => props.onDelete(item.task)}
                    subtitle={`Last run: ${props.formatTime(item.lastRun)}`}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <For each={props.groupedTasks}>
        {(section) => (
          <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
            <Button
              variant="ghost"
              style={{ width: "100%", "justify-content": "flex-start", "border-radius": "0" }}
              onClick={() => props.toggleGroup(section.group)}
            >
              {props.expandedGroups.has(section.group) ? (
                <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              ) : (
                <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              )}
              <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                {section.label}
              </span>
              <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
                {section.tasks.length}
              </span>
            </Button>
            
            <Show when={props.expandedGroups.has(section.group)}>
              <div class="pb-2">
                <For each={section.tasks}>
                  {(task) => (
                    <TaskItem
                      task={task}
                      onRun={() => props.onRun(task)}
                      onRunInTerminal={() => props.onRunInTerminal(task)}
                      onEdit={() => props.onEdit(task)}
                      onDelete={() => props.onDelete(task)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>

      <Show when={props.totalTasks === 0}>
        <div class="flex flex-col items-center justify-center py-12">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface-hover)" }}>
            <Icon name="play" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
          </div>
          <p class="text-sm font-medium mb-1" style={{ color: "var(--text-strong)" }}>
            No tasks found
          </p>
          <p class="text-xs mb-4" style={{ color: "var(--text-weak)" }}>
            Create a task or open a project to auto-detect tasks
          </p>
          <Button
            variant="primary"
            onClick={() => props.onCreateTask()}
          >
            Create Task
          </Button>
        </div>
      </Show>
    </>
  );
}

interface RunningTasksTabProps {
  runningTasks: TaskRun[];
  getStatusIcon: (status: TaskRun["status"]) => JSX.Element;
  formatDuration: (start: number, end?: number) => string;
  onCancel: (runId: string) => void;
}

export function RunningTasksTab(props: RunningTasksTabProps) {
  return (
    <>
      <Show when={props.runningTasks.length === 0}>
        <div class="flex flex-col items-center justify-center py-12">
          <p class="text-sm" style={{ color: "var(--text-weak)" }}>
            No tasks currently running
          </p>
        </div>
      </Show>

      <For each={props.runningTasks}>
        {(run) => (
          <div 
            class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
            style={{ "border-color": "var(--border-base)" }}
          >
            {props.getStatusIcon(run.status)}
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                {run.taskLabel}
              </div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                Running for {props.formatDuration(run.startedAt)}
              </div>
            </div>
            <IconButton
              onClick={() => props.onCancel(run.id)}
              tooltip="Cancel"
            >
              <Icon name="stop" class="w-4 h-4 text-red-400" />
            </IconButton>
          </div>
        )}
      </For>
    </>
  );
}

interface HistoryTabProps {
  taskHistory: TaskRun[];
  getStatusIcon: (status: TaskRun["status"]) => JSX.Element;
  formatTime: (timestamp: number) => string;
  formatDuration: (start: number, end?: number) => string;
  onRerun: (run: TaskRun) => void;
}

export function HistoryTab(props: HistoryTabProps) {
  return (
    <>
      <Show when={props.taskHistory.length === 0}>
        <div class="flex flex-col items-center justify-center py-12">
          <p class="text-sm" style={{ color: "var(--text-weak)" }}>
            No task history
          </p>
        </div>
      </Show>

      <For each={props.taskHistory.slice(0, 50)}>
        {(run) => (
          <div 
            class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
            style={{ "border-color": "var(--border-base)" }}
          >
            {props.getStatusIcon(run.status)}
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                {run.taskLabel}
              </div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                {props.formatTime(run.startedAt)} • {props.formatDuration(run.startedAt, run.finishedAt)}
                {run.exitCode !== undefined && ` • Exit code: ${run.exitCode}`}
              </div>
            </div>
            <IconButton
              onClick={() => props.onRerun(run)}
              tooltip="Rerun"
            >
              <Icon name="play" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </IconButton>
          </div>
        )}
      </For>
    </>
  );
}
