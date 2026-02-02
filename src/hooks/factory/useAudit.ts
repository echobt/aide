/**
 * useAudit - Audit log hook with filtering and pagination
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  batch,
  Accessor,
} from "solid-js";

import type {
  AuditEntry,
  AuditFilter,
  AuditEventType,
  AuditSeverity,
  WorkflowId,
  ExecutionId,
} from "../../types/factory";

import { useFactory } from "../../context/FactoryContext";

// ============================================================================
// Types
// ============================================================================

export interface AuditStats {
  /** Total entries matching filter */
  totalCount: number;
  /** Entries by severity */
  bySeverity: Record<AuditSeverity, number>;
  /** Entries by event type */
  byEventType: Partial<Record<AuditEventType, number>>;
  /** Entries over time (hourly buckets for last 24h) */
  hourlyDistribution: { hour: number; count: number }[];
}

export interface UseAuditOptions {
  /** Initial filter */
  initialFilter?: AuditFilter;
  /** Page size */
  pageSize?: number;
  /** Auto-load on mount */
  autoLoad?: boolean;
  /** Called when entries are loaded */
  onLoad?: (entries: AuditEntry[]) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseAuditReturn {
  // State
  entries: Accessor<AuditEntry[]>;
  filter: Accessor<AuditFilter>;
  isLoading: Accessor<boolean>;
  hasMore: Accessor<boolean>;
  error: Accessor<string | null>;
  stats: Accessor<AuditStats | null>;

  // Filter operations
  setFilter: (filter: AuditFilter) => void;
  updateFilter: (updates: Partial<AuditFilter>) => void;
  clearFilter: () => void;

  // Convenience filter setters
  filterByWorkflow: (workflowId: WorkflowId | null) => void;
  filterByExecution: (executionId: ExecutionId | null) => void;
  filterByUser: (userId: string | null) => void;
  filterByEventTypes: (types: AuditEventType[] | null) => void;
  filterBySeverity: (severities: AuditSeverity[] | null) => void;
  filterByTimeRange: (startTime: number | null, endTime: number | null) => void;
  filterBySearch: (search: string | null) => void;

  // Data operations
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // Export
  exportToJSON: () => Promise<string>;
  exportToCSV: () => Promise<string>;

  // Stats
  loadStats: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAudit(options: UseAuditOptions = {}): UseAuditReturn {
  const {
    initialFilter = {},
    pageSize = 50,
    autoLoad = true,
    onLoad,
    onError,
  } = options;

  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  const [filter, setFilterState] = createSignal<AuditFilter>(initialFilter);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [stats, setStats] = createSignal<AuditStats | null>(null);

  // ============================================================================
  // Computed
  // ============================================================================

  const entries = createMemo(() => factory.auditEntries());
  const hasMore = createMemo(() => factory.auditHasMore());

  // ============================================================================
  // Filter Operations
  // ============================================================================

  const setFilter = (newFilter: AuditFilter): void => {
    setFilterState(newFilter);
  };

  const updateFilter = (updates: Partial<AuditFilter>): void => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const clearFilter = (): void => {
    setFilterState({});
  };

  // Convenience filter setters
  const filterByWorkflow = (workflowId: WorkflowId | null): void => {
    updateFilter({ workflowId: workflowId ?? undefined });
  };

  const filterByExecution = (executionId: ExecutionId | null): void => {
    updateFilter({ executionId: executionId ?? undefined });
  };

  const filterByUser = (userId: string | null): void => {
    updateFilter({ userId: userId ?? undefined });
  };

  const filterByEventTypes = (types: AuditEventType[] | null): void => {
    updateFilter({ eventTypes: types ?? undefined });
  };

  const filterBySeverity = (severities: AuditSeverity[] | null): void => {
    updateFilter({ severities: severities ?? undefined });
  };

  const filterByTimeRange = (startTime: number | null, endTime: number | null): void => {
    updateFilter({
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
    });
  };

  const filterBySearch = (search: string | null): void => {
    updateFilter({ search: search ?? undefined });
  };

  // ============================================================================
  // Data Operations
  // ============================================================================

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await factory.loadAuditLog(filter());
      onLoad?.(entries());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load audit log";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async (): Promise<void> => {
    if (!hasMore() || isLoading()) return;

    setIsLoading(true);
    setError(null);

    try {
      await factory.loadMoreAuditEntries();
      onLoad?.(entries());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load more audit entries";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async (): Promise<void> => {
    await load();
  };

  // ============================================================================
  // Export Operations
  // ============================================================================

  const exportToJSON = async (): Promise<string> => {
    try {
      return await factory.exportAuditLog(filter(), "json");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to export audit log";
      setError(message);
      throw e;
    }
  };

  const exportToCSV = async (): Promise<string> => {
    try {
      return await factory.exportAuditLog(filter(), "csv");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to export audit log";
      setError(message);
      throw e;
    }
  };

  // ============================================================================
  // Stats
  // ============================================================================

  const loadStats = async (): Promise<void> => {
    const currentEntries = entries();
    if (currentEntries.length === 0) {
      setStats(null);
      return;
    }

    // Calculate stats from current entries
    const bySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byEventType: Partial<Record<AuditEventType, number>> = {};

    // Calculate hourly distribution for last 24 hours
    const now = Date.now();
    const hourlyBuckets: Record<number, number> = {};
    
    for (let i = 0; i < 24; i++) {
      hourlyBuckets[i] = 0;
    }

    for (const entry of currentEntries) {
      // Count by severity
      bySeverity[entry.severity]++;

      // Count by event type
      byEventType[entry.eventType] = (byEventType[entry.eventType] ?? 0) + 1;

      // Hourly distribution
      const hoursAgo = Math.floor((now - entry.timestamp) / (1000 * 60 * 60));
      if (hoursAgo >= 0 && hoursAgo < 24) {
        hourlyBuckets[hoursAgo]++;
      }
    }

    const hourlyDistribution = Object.entries(hourlyBuckets)
      .map(([hour, count]) => ({
        hour: parseInt(hour, 10),
        count,
      }))
      .sort((a, b) => a.hour - b.hour);

    setStats({
      totalCount: currentEntries.length,
      bySeverity,
      byEventType,
      hourlyDistribution,
    });
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Reload when filter changes
  createEffect(() => {
    const currentFilter = filter();
    // Only reload if not the initial load
    if (autoLoad) {
      load().catch(console.error);
    }
  });

  // Auto-load on mount
  if (autoLoad) {
    load().catch(console.error);
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    entries,
    filter,
    isLoading,
    hasMore,
    error,
    stats,

    // Filter operations
    setFilter,
    updateFilter,
    clearFilter,

    // Convenience filter setters
    filterByWorkflow,
    filterByExecution,
    filterByUser,
    filterByEventTypes,
    filterBySeverity,
    filterByTimeRange,
    filterBySearch,

    // Data operations
    load,
    loadMore,
    refresh,

    // Export
    exportToJSON,
    exportToCSV,

    // Stats
    loadStats,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format an audit entry for display
 */
export function formatAuditEntry(entry: AuditEntry): {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  time: string;
} {
  const iconMap: Record<AuditSeverity, string> = {
    info: "info",
    warning: "warning",
    error: "error",
    critical: "error_outline",
  };

  const colorMap: Record<AuditSeverity, string> = {
    info: "text-blue-500",
    warning: "text-yellow-500",
    error: "text-red-500",
    critical: "text-red-700",
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return {
    icon: iconMap[entry.severity],
    color: colorMap[entry.severity],
    title: entry.message,
    subtitle: entry.eventType.replace(/_/g, " "),
    time: formatTime(entry.timestamp),
  };
}

/**
 * Group audit entries by date
 */
export function groupAuditEntriesByDate(
  entries: AuditEntry[]
): { date: string; entries: AuditEntry[] }[] {
  const groups: Record<string, AuditEntry[]> = {};

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
  }

  return Object.entries(groups)
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => {
      const dateA = new Date(a.entries[0].timestamp);
      const dateB = new Date(b.entries[0].timestamp);
      return dateB.getTime() - dateA.getTime();
    });
}
