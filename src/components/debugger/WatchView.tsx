import { Show, For, createSignal } from "solid-js";
import { useDebug, WatchExpression } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";

export function WatchView() {
  const debug = useDebug();
  const [newExpression, setNewExpression] = createSignal("");
  const [isAdding, setIsAdding] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingValue, setEditingValue] = createSignal("");

  const handleAddExpression = () => {
    const expr = newExpression().trim();
    if (!expr) return;

    debug.addWatchExpression(expr);
    setNewExpression("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddExpression();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewExpression("");
    }
  };

  const handleRefreshAll = async () => {
    await debug.refreshWatches();
  };

  const handleStartEdit = (watch: WatchExpression) => {
    setEditingId(watch.id);
    setEditingValue(watch.expression);
  };

  const handleSaveEdit = () => {
    const id = editingId();
    const newExpr = editingValue().trim();
    if (id && newExpr) {
      debug.removeWatchExpression(id);
      debug.addWatchExpression(newExpr);
    }
    setEditingId(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const getValueColor = (watch: WatchExpression) => {
    if (watch.error) return "var(--cortex-error)";
    if (!watch.result) return "var(--text-weak)";

    const type = watch.type?.toLowerCase() || "";
    const value = watch.result;

    if (type.includes("string") || value.startsWith('"') || value.startsWith("'")) {
      return "var(--cortex-syntax-string)";
    }
    if (type.includes("number") || /^-?\d+\.?\d*$/.test(value)) {
      return "var(--cortex-syntax-number)";
    }
    if (value === "true" || value === "false") {
      return "var(--cortex-syntax-keyword)";
    }
    if (value === "null" || value === "undefined") {
      return "var(--cortex-text-inactive)";
    }
    return "var(--text-base)";
  };

  return (
    <div class="py-1">
      {/* Header with add button */}
      <div class="flex items-center justify-between px-2 pb-1">
        <Show when={debug.state.watchExpressions.length > 0}>
          <button
            onClick={handleRefreshAll}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Refresh all"
          >
            <Icon name="rotate" size="xs" />
          </button>
        </Show>
        <button
          onClick={() => setIsAdding(true)}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Add expression"
        >
          <Icon name="plus" size="xs" />
        </button>
      </div>

      {/* Add new expression input */}
      <Show when={isAdding()}>
        <div class="px-2 pb-2">
          <input
            type="text"
            value={newExpression()}
            onInput={(e) => setNewExpression(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!newExpression().trim()) {
                setIsAdding(false);
              }
            }}
            placeholder="Enter expression to watch"
            class="w-full px-2 py-1 text-xs rounded outline-none"
            style={{
              background: "var(--surface-sunken)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)",
            }}
            autofocus
          />
        </div>
      </Show>

      {/* Watch expressions list */}
      <Show
        when={debug.state.watchExpressions.length > 0}
        fallback={
          <Show when={!isAdding()}>
            <div class="text-xs text-center py-4" style={{ color: "var(--text-weak)" }}>
              No watch expressions.
              <br />
              <button
                onClick={() => setIsAdding(true)}
                class="underline hover:no-underline"
              >
                Add expression
              </button>
            </div>
          </Show>
        }
      >
        <For each={debug.state.watchExpressions}>
          {(watch) => (
            <div 
              class="group flex items-center gap-1 px-2 text-xs transition-colors hover:bg-[var(--surface-raised)]"
              style={{ height: "22px" }}
            >
              {/* Expression - inline editable */}
              <Show
                when={editingId() === watch.id}
                fallback={
                  <div 
                    class="flex-1 min-w-0 flex items-center gap-1 cursor-text"
                    onDblClick={() => handleStartEdit(watch)}
                  >
                    <span class="shrink-0" style={{ color: "var(--cortex-syntax-variable)" }}>{watch.expression}</span>
                    <span class="shrink-0" style={{ color: "var(--text-weak)" }}>=</span>
                    <span class="truncate" style={{ color: getValueColor(watch) }}>
                      <Show
                        when={!watch.error}
                        fallback={
                          <span class="flex items-center gap-1">
                            <Icon name="circle-exclamation" size="xs" class="shrink-0" />
                            <span class="truncate">{watch.error}</span>
                          </span>
                        }
                      >
                        <Show when={watch.result !== undefined} fallback="<not evaluated>">
                          {watch.type && <span class="opacity-60">[{watch.type}] </span>}
                          {watch.result}
                        </Show>
                      </Show>
                    </span>
                  </div>
                }
              >
                <input
                  type="text"
                  value={editingValue()}
                  onInput={(e) => setEditingValue(e.currentTarget.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={handleSaveEdit}
                  class="flex-1 px-1 py-0 text-xs rounded outline-none"
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-base)",
                    border: "1px solid var(--accent)",
                    height: "18px",
                    "line-height": "18px"
                  }}
                  autofocus
                />
              </Show>

              {/* Refresh single */}
              <button
                onClick={() => debug.evaluateWatch(watch.id)}
                class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Refresh"
              >
<Icon name="rotate" size="xs" />
              </button>

              {/* Remove button */}
              <button
                onClick={() => debug.removeWatchExpression(watch.id)}
                class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Remove"
              >
                <Icon name="xmark" size="xs" />
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

