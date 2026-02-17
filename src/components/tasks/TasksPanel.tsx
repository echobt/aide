import { createSignal, Show, For, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useTasks, type TaskConfig, type TaskGroup, type TaskRun, type BackgroundTaskStatus } from "@/context/TasksContext";
import { Button, IconButton } from "@/components/ui";
import { AllTasksTab, RunningTasksTab, HistoryTab, type TaskGroupSection } from "@/components/tasks/TaskGroup";
import { BackgroundTasksTab, RunOnSaveTab } from "@/components/tasks/TaskFilters";

export function TasksPanel() {
  const tasks = useTasks();
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set(["build", "test", "run", "recent"]));
  const [activeTab, setActiveTab] = createSignal<"all" | "running" | "background" | "history" | "runOnSave">("all");
  
  const [newRunOnSaveTask, setNewRunOnSaveTask] = createSignal<string>("");
  const [newRunOnSavePattern, setNewRunOnSavePattern] = createSignal<string>("**/*");
  const [newRunOnSaveDelay, setNewRunOnSaveDelay] = createSignal<number>(500);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const groupedTasks = createMemo((): TaskGroupSection[] => {
    const allTasks = tasks.allTasks();
    const groups: Record<TaskGroup, TaskConfig[]> = {
      build: [],
      test: [],
      run: [],
      clean: [],
      deploy: [],
      none: [],
    };

    for (const task of allTasks) {
      const group = task.group || "none";
      groups[group].push(task);
    }

    const sections: TaskGroupSection[] = [
      { group: "build" as TaskGroup, label: "Build", tasks: groups.build },
      { group: "test" as TaskGroup, label: "Test", tasks: groups.test },
      { group: "run" as TaskGroup, label: "Run", tasks: groups.run },
      { group: "clean" as TaskGroup, label: "Clean", tasks: groups.clean },
      { group: "deploy" as TaskGroup, label: "Deploy", tasks: groups.deploy },
      { group: "none" as TaskGroup, label: "Other", tasks: groups.none },
    ];
    return sections.filter(g => g.tasks.length > 0);
  });

  const recentTasks = createMemo(() => {
    const allTasks = tasks.allTasks();
    return tasks.state.recentTasks
      .map(recent => {
        const task = allTasks.find(t => t.label === recent.taskLabel);
        return task ? { ...recent, task } : null;
      })
      .filter((r): r is { taskLabel: string; lastRun: number; runCount: number; task: TaskConfig } => r !== null)
      .slice(0, 5);
  });

  const handleRunTask = async (task: TaskConfig) => {
    await tasks.runTask(task);
    tasks.closeTasksPanel();
  };

  const handleRunTaskInTerminal = async (task: TaskConfig) => {
    await tasks.runTaskInTerminal(task);
    tasks.closeTasksPanel();
  };

  const handleEditTask = (task: TaskConfig) => {
    tasks.openConfigEditor(task);
  };

  const handleDeleteTask = (task: TaskConfig) => {
    if (task.source === "user") {
      tasks.removeTask(task.label);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  const getStatusIcon = (status: TaskRun["status"]) => {
    switch (status) {
      case "running": return <Icon name="play" class="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
      case "completed": return <Icon name="check" class="w-3.5 h-3.5 text-green-400" />;
      case "failed": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
      case "cancelled": return <Icon name="stop" class="w-3.5 h-3.5 text-yellow-400" />;
      default: return <Icon name="clock" class="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getBackgroundStatusIcon = (status: BackgroundTaskStatus | undefined) => {
    switch (status) {
      case "watching": return <Icon name="eye" class="w-3.5 h-3.5 text-green-400" />;
      case "compiling": return <Icon name="spinner" class="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      case "idle": return <Icon name="pause" class="w-3.5 h-3.5 text-gray-400" />;
      case "error": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
      default: return <Icon name="eye" class="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getBackgroundStatusText = (status: BackgroundTaskStatus | undefined) => {
    switch (status) {
      case "watching": return "Watching...";
      case "compiling": return "Compiling...";
      case "idle": return "Idle";
      case "error": return "Error";
      default: return "Running";
    }
  };

  return (
    <Show when={tasks.state.showTasksPanel}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => { if (e.target === e.currentTarget) tasks.closeTasksPanel(); }}
      >
        <div 
          class="w-[600px] max-h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
        >
          <div 
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--cortex-info)20" }}>
                <Icon name="play" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>Tasks</h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {tasks.allTasks().length} tasks available
                </p>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <IconButton
                onClick={() => tasks.refreshTasks()}
                tooltip="Refresh tasks"
              >
                <Icon name="rotate" class="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => tasks.openConfigEditor()}
                tooltip="New task"
              >
                <Icon name="plus" class="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => tasks.closeTasksPanel()}
              >
                <Icon name="xmark" class="w-5 h-5" />
              </IconButton>
            </div>
          </div>

          <div class="flex border-b shrink-0" style={{ "border-color": "var(--border-base)" }}>
            <For each={[
              { id: "all" as const, label: "All Tasks" },
              { id: "running" as const, label: `Running (${tasks.state.runningTasks.length})` },
            ]}>
              {(tab) => (
                <Button
                  variant="ghost"
                  style={{
                    "border-radius": "0",
                    color: activeTab() === tab.id ? "var(--text-strong)" : "var(--text-weak)",
                    "border-bottom": activeTab() === tab.id ? "2px solid var(--cortex-info)" : "2px solid transparent",
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              )}
            </For>
            <Button
              variant="ghost"
              icon={<Icon name="eye" class="w-3.5 h-3.5" />}
              style={{
                "border-radius": "0",
                color: activeTab() === "background" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "background" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("background")}
            >
              Watching
              <Show when={tasks.state.backgroundTasks.length > 0}>
                <span class="text-xs px-1 rounded" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
                  {tasks.state.backgroundTasks.length}
                </span>
              </Show>
            </Button>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "history" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "history" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("history")}
            >
              History
            </Button>
            <Button
              variant="ghost"
              icon={<Icon name="floppy-disk" class="w-3.5 h-3.5" />}
              style={{
                "border-radius": "0",
                color: activeTab() === "runOnSave" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "runOnSave" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("runOnSave")}
            >
              Run on Save
              <Show when={tasks.state.runOnSave.length > 0}>
                <span class="text-xs px-1 rounded" style={{ background: "var(--surface-hover)" }}>
                  {tasks.state.runOnSave.length}
                </span>
              </Show>
            </Button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <Show when={activeTab() === "all"}>
              <AllTasksTab
                groupedTasks={groupedTasks()}
                recentTasks={recentTasks()}
                expandedGroups={expandedGroups()}
                toggleGroup={toggleGroup}
                onRun={handleRunTask}
                onRunInTerminal={handleRunTaskInTerminal}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onCreateTask={() => tasks.openConfigEditor()}
                formatTime={formatTime}
                totalTasks={tasks.allTasks().length}
              />
            </Show>

            <Show when={activeTab() === "running"}>
              <RunningTasksTab
                runningTasks={tasks.state.runningTasks}
                getStatusIcon={getStatusIcon}
                formatDuration={formatDuration}
                onCancel={(runId) => tasks.cancelTask(runId)}
              />
            </Show>

            <Show when={activeTab() === "background"}>
              <BackgroundTasksTab
                availableTasks={tasks.backgroundTasks()}
                runningBackgroundTasks={tasks.state.backgroundTasks}
                isTaskRunning={(label) => tasks.state.backgroundTasks.some(r => r.taskLabel === label)}
                onStartBackground={(task) => tasks.runBackgroundTask(task)}
                onStopBackground={(runId) => tasks.stopBackgroundTask(runId)}
                getBackgroundStatusIcon={getBackgroundStatusIcon}
                getBackgroundStatusText={getBackgroundStatusText}
                formatDuration={formatDuration}
                formatTime={formatTime}
              />
            </Show>

            <Show when={activeTab() === "history"}>
              <HistoryTab
                taskHistory={tasks.state.taskHistory}
                getStatusIcon={getStatusIcon}
                formatTime={formatTime}
                formatDuration={formatDuration}
                onRerun={(run) => tasks.rerunTask(run)}
              />
            </Show>

            <Show when={activeTab() === "runOnSave"}>
              <RunOnSaveTab
                allTasks={tasks.allTasks()}
                runOnSaveConfigs={tasks.state.runOnSave}
                runOnSaveEnabled={tasks.state.runOnSaveEnabled}
                onToggleEnabled={() => tasks.toggleRunOnSaveEnabled()}
                onAddRunOnSave={(taskId, pattern, delay) => tasks.addRunOnSave(taskId, pattern, delay)}
                onUpdateRunOnSave={(id, updates) => tasks.updateRunOnSave(id, updates)}
                onRemoveRunOnSave={(id) => tasks.removeRunOnSave(id)}
                newTask={newRunOnSaveTask}
                setNewTask={setNewRunOnSaveTask}
                newPattern={newRunOnSavePattern}
                setNewPattern={setNewRunOnSavePattern}
                newDelay={newRunOnSaveDelay}
                setNewDelay={setNewRunOnSaveDelay}
              />
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
