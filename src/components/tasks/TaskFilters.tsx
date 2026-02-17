import { Show, For, type JSX, type Accessor, type Setter } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { IconButton, Input } from "@/components/ui";
import { RunOnSaveItem } from "@/components/tasks/TaskItem";
import type { TaskConfig, TaskRun, BackgroundTaskStatus, RunOnSaveConfig } from "@/context/TasksContext";

interface BackgroundTasksTabProps {
  availableTasks: TaskConfig[];
  runningBackgroundTasks: TaskRun[];
  isTaskRunning: (taskLabel: string) => boolean;
  onStartBackground: (task: TaskConfig) => void;
  onStopBackground: (runId: string) => void;
  getBackgroundStatusIcon: (status: BackgroundTaskStatus | undefined) => JSX.Element;
  getBackgroundStatusText: (status: BackgroundTaskStatus | undefined) => string;
  formatDuration: (start: number, end?: number) => string;
  formatTime: (timestamp: number) => string;
}

export function BackgroundTasksTab(props: BackgroundTasksTabProps) {
  return (
    <>
      <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
        <div class="px-4 py-2 text-xs font-medium" style={{ color: "var(--text-weak)" }}>
          Available Background Tasks
        </div>
        <Show when={props.availableTasks.length === 0}>
          <div class="px-4 py-3 text-sm" style={{ color: "var(--text-weak)" }}>
            No background tasks configured. Tasks with <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>isBackground: true</code> will appear here.
          </div>
        </Show>
        <For each={props.availableTasks}>
          {(task) => {
            const isRunning = () => props.isTaskRunning(task.label);
            return (
              <div 
                class="flex items-center gap-3 px-4 py-2 mx-2 rounded hover:bg-[var(--surface-hover)] group"
              >
                <Icon name="eye" class="w-4 h-4" style={{ color: isRunning() ? "var(--cortex-success)" : "var(--text-weak)" }} />
                <div class="flex-1 min-w-0">
                  <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                    {task.label}
                  </div>
                  <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                    {task.command} {task.args?.join(" ")}
                  </div>
                </div>
                <Show when={!isRunning()}>
                  <IconButton
                    onClick={() => props.onStartBackground(task)}
                    tooltip="Start watching"
                  >
                    <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                  </IconButton>
                </Show>
                <Show when={isRunning()}>
                  <span class="text-xs px-1.5 rounded" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
                    Running
                  </span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <div class="px-4 py-2 text-xs font-medium" style={{ color: "var(--text-weak)" }}>
        Running Watchers ({props.runningBackgroundTasks.length})
      </div>
      
      <Show when={props.runningBackgroundTasks.length === 0}>
        <div class="flex flex-col items-center justify-center py-8">
          <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--surface-hover)" }}>
            <Icon name="eye" class="w-6 h-6" style={{ color: "var(--text-weak)" }} />
          </div>
          <p class="text-sm" style={{ color: "var(--text-weak)" }}>
            No background tasks running
          </p>
          <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
            Start a background task to watch for changes
          </p>
        </div>
      </Show>

      <For each={props.runningBackgroundTasks}>
        {(run) => (
          <div 
            class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
            style={{ "border-color": "var(--border-base)" }}
          >
            {props.getBackgroundStatusIcon(run.backgroundStatus)}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                  {run.taskLabel}
                </span>
                <span 
                  class="text-xs px-1.5 py-0.5 rounded"
                  style={{ 
                    background: run.backgroundStatus === "compiling" ? "var(--cortex-info)20" : 
                               run.backgroundStatus === "watching" ? "var(--cortex-success)20" : 
                               run.backgroundStatus === "error" ? "var(--cortex-error)20" : "var(--surface-hover)",
                    color: run.backgroundStatus === "compiling" ? "var(--cortex-info)" : 
                           run.backgroundStatus === "watching" ? "var(--cortex-success)" : 
                           run.backgroundStatus === "error" ? "var(--cortex-error)" : "var(--text-weak)",
                  }}
                >
                  {props.getBackgroundStatusText(run.backgroundStatus)}
                </span>
              </div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                Running for {props.formatDuration(run.startedAt)}
                {run.lastCompileEnd && ` • Last compile: ${props.formatTime(run.lastCompileEnd)}`}
              </div>
            </div>
            <IconButton
              onClick={() => props.onStopBackground(run.id)}
              tooltip="Stop watching"
            >
              <Icon name="stop" class="w-4 h-4 text-red-400" />
            </IconButton>
          </div>
        )}
      </For>
    </>
  );
}

interface RunOnSaveTabProps {
  allTasks: TaskConfig[];
  runOnSaveConfigs: RunOnSaveConfig[];
  runOnSaveEnabled: boolean;
  onToggleEnabled: () => void;
  onAddRunOnSave: (taskId: string, pattern: string, delay: number) => void;
  onUpdateRunOnSave: (id: string, updates: Partial<RunOnSaveConfig>) => void;
  onRemoveRunOnSave: (id: string) => void;
  newTask: Accessor<string>;
  setNewTask: Setter<string>;
  newPattern: Accessor<string>;
  setNewPattern: Setter<string>;
  newDelay: Accessor<number>;
  setNewDelay: Setter<number>;
}

export function RunOnSaveTab(props: RunOnSaveTabProps) {
  return (
    <>
      <div 
        class="flex items-center justify-between px-4 py-3 border-b"
        style={{ "border-color": "var(--border-base)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="floppy-disk" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Enable Run on Save
          </span>
        </div>
        <IconButton
          onClick={() => props.onToggleEnabled()}
          tooltip={props.runOnSaveEnabled ? "Disable" : "Enable"}
        >
          {props.runOnSaveEnabled ? (
            <Icon name="toggle-on" class="w-6 h-6" style={{ color: "var(--cortex-success)" }} />
          ) : (
            <Icon name="toggle-off" class="w-6 h-6" style={{ color: "var(--text-weak)" }} />
          )}
        </IconButton>
      </div>

      <div class="px-4 py-3 border-b" style={{ "border-color": "var(--border-base)" }}>
        <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
          Add Run on Save Rule
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex gap-2">
            <select
              value={props.newTask()}
              onChange={(e) => props.setNewTask(e.currentTarget.value)}
              class="flex-1 px-2 py-1.5 text-sm rounded border"
              style={{
                background: "var(--surface-hover)",
                "border-color": "var(--border-base)",
                color: "var(--text-base)",
              }}
            >
              <option value="">Select a task...</option>
              <For each={props.allTasks}>
                {(task) => (
                  <option value={task.label}>{task.label}</option>
                )}
              </For>
            </select>
          </div>
          <div class="flex gap-2">
            <Input
              type="text"
              value={props.newPattern()}
              onInput={(e) => props.setNewPattern(e.currentTarget.value)}
              placeholder="Glob pattern (e.g., **/*.ts)"
              style={{ flex: "1" }}
            />
            <Input
              type="number"
              value={props.newDelay()}
              onInput={(e) => props.setNewDelay(parseInt(e.currentTarget.value) || 500)}
              min={0}
              max={10000}
              step={100}
              style={{ width: "80px" }}
              title="Debounce delay (ms)"
            />
            <IconButton
              onClick={() => {
                if (props.newTask() && props.newPattern()) {
                  props.onAddRunOnSave(props.newTask(), props.newPattern(), props.newDelay());
                  props.setNewTask("");
                  props.setNewPattern("**/*");
                  props.setNewDelay(500);
                }
              }}
              disabled={!props.newTask() || !props.newPattern()}
              style={{ background: "var(--cortex-info)", color: "white" }}
            >
              <Icon name="plus" class="w-4 h-4" />
            </IconButton>
          </div>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            Pattern examples: <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>*.ts</code>{" "}
            <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>**/*.{"{ts,tsx}"}</code>{" "}
            <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>src/**/*</code>
          </div>
        </div>
      </div>

      <Show when={props.runOnSaveConfigs.length === 0}>
        <div class="flex flex-col items-center justify-center py-12">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface-hover)" }}>
            <Icon name="floppy-disk" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
          </div>
          <p class="text-sm font-medium mb-1" style={{ color: "var(--text-strong)" }}>
            No run on save rules
          </p>
          <p class="text-xs" style={{ color: "var(--text-weak)" }}>
            Add a rule above to automatically run tasks when files are saved
          </p>
        </div>
      </Show>

      <For each={props.runOnSaveConfigs}>
        {(config) => (
          <RunOnSaveItem
            config={config}
            taskLabel={props.allTasks.find(t => t.label === config.taskId)?.label || config.taskId}
            onToggle={() => props.onUpdateRunOnSave(config.id, { enabled: !config.enabled })}
            onDelete={() => props.onRemoveRunOnSave(config.id)}
          />
        )}
      </For>
    </>
  );
}
