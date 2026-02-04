/**
 * Testing API for Cortex IDE Extensions
 *
 * Provides the `cortex.tests` namespace for extensions to create and manage
 * test controllers, test items, test runs, and test run profiles.
 * Compatible with VS Code's Testing API structure.
 */

import {
  DisposableStore,
  Uri,
  CancellationToken,
  CancellationTokenSource,
} from "../types";

import type { ExtensionApiBridge } from "../ExtensionAPI";

import {
  TestRunProfileKind,
} from "../../types/testing";

import type {
  TestController,
  TestItem,
  TestItemCollection,
  TestTag,
  TestRunProfile,
  TestRun,
  TestRunRequest,
  TestMessage,
  FileCoverage,
  MarkdownString,
  Location,
} from "../../types/testing";

// Re-export TestRunProfileKind enum for extensions
export { TestRunProfileKind };

// Re-export types for extensions
export type {
  TestController,
  TestItem,
  TestItemCollection,
  TestTag,
  TestRunProfile,
  TestRun,
  TestRunRequest,
  TestMessage,
} from "../../types/testing";

// ============================================================================
// Tests API Interface
// ============================================================================

/**
 * The tests API exposed to extensions as `cortex.tests`.
 */
export interface TestsApi {
  /**
   * Creates a new test controller.
   * @param id Unique identifier for the controller
   * @param label Human-readable label for the controller
   * @returns The created test controller
   */
  createTestController(id: string, label: string): TestController;
}

// ============================================================================
// Internal Types
// ============================================================================

interface TestItemInternal extends TestItem {
  _controllerId: string;
  _children: TestItemCollectionInternal;
  _parent?: TestItemInternal;
  _tags: TestTag[];
}

interface TestItemCollectionInternal extends TestItemCollection {
  _items: Map<string, TestItemInternal>;
  _parent?: TestItemInternal;
}

interface TestRunInternal extends TestRun {
  _id: string;
  _controllerId: string;
  _ended: boolean;
}

interface TestRunProfileInternal extends TestRunProfile {
  _id: string;
  _controllerId: string;
}

// ============================================================================
// Test Item Collection Implementation
// ============================================================================

function createTestItemCollection(
  extensionId: string,
  controllerId: string,
  bridge: ExtensionApiBridge,
  parent?: TestItemInternal
): TestItemCollectionInternal {
  const items = new Map<string, TestItemInternal>();

  const collection: TestItemCollectionInternal = {
    _items: items,
    _parent: parent,

    get size(): number {
      return items.size;
    },

    add(item: TestItem): void {
      const internalItem = item as TestItemInternal;
      items.set(item.id, internalItem);

      // Notify main thread
      bridge.callMainThread(extensionId, "tests", "addTestItem", [
        controllerId,
        parent?.id ?? null,
        serializeTestItem(internalItem),
      ]);
    },

    delete(id: string): void {
      const item = items.get(id);
      if (item) {
        items.delete(id);
        bridge.callMainThread(extensionId, "tests", "deleteTestItem", [
          controllerId,
          id,
        ]);
      }
    },

    get(id: string): TestItem | undefined {
      return items.get(id);
    },

    replace(newItems: readonly TestItem[]): void {
      items.clear();
      for (const item of newItems) {
        items.set(item.id, item as TestItemInternal);
      }

      bridge.callMainThread(extensionId, "tests", "replaceTestItems", [
        controllerId,
        parent?.id ?? null,
        newItems.map((item) => serializeTestItem(item as TestItemInternal)),
      ]);
    },

    forEach(callback: (item: TestItem, collection: TestItemCollection) => unknown): void {
      for (const item of items.values()) {
        callback(item, collection);
      }
    },

    [Symbol.iterator](): Iterator<[string, TestItem]> {
      return items.entries();
    },
  };

  return collection;
}

// ============================================================================
// Test Item Implementation
// ============================================================================

function createTestItem(
  extensionId: string,
  controllerId: string,
  bridge: ExtensionApiBridge,
  id: string,
  label: string,
  uri?: Uri,
  parent?: TestItemInternal
): TestItemInternal {
  const children = createTestItemCollection(extensionId, controllerId, bridge);

  const item: TestItemInternal = {
    _controllerId: controllerId,
    _children: children,
    _parent: parent,
    _tags: [],

    id,
    label,
    uri,
    description: undefined,
    sortText: undefined,
    range: undefined,
    error: undefined,
    busy: false,
    canResolveChildren: false,

    get tags(): readonly TestTag[] {
      return this._tags;
    },

    get children(): TestItemCollection {
      return this._children;
    },

    get parent(): TestItem | undefined {
      return this._parent;
    },
  };

  // Set up children's parent reference
  children._parent = item;

  return item;
}

// ============================================================================
// Test Run Implementation
// ============================================================================

function createTestRun(
  extensionId: string,
  controllerId: string,
  bridge: ExtensionApiBridge,
  request: TestRunRequest,
  name?: string,
  persist = true
): TestRunInternal {
  const runId = crypto.randomUUID();
  const tokenSource = new CancellationTokenSource();

  // Notify main thread about the new test run
  bridge.callMainThread(extensionId, "tests", "createTestRun", [
    controllerId,
    runId,
    {
      name,
      persist,
      include: request.include?.map((item) => item.id),
      exclude: request.exclude?.map((item) => item.id),
    },
  ]);

  const run: TestRunInternal = {
    _id: runId,
    _controllerId: controllerId,
    _ended: false,

    name,
    token: tokenSource.token,
    isPersisted: persist,

    enqueued(test: TestItem): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "enqueued",
        { testId: test.id },
      ]);
    },

    started(test: TestItem): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "started",
        { testId: test.id },
      ]);
    },

    skipped(test: TestItem): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "skipped",
        { testId: test.id },
      ]);
    },

    failed(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void {
      if (this._ended) return;
      const messages = Array.isArray(message) ? message : [message];
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "failed",
        {
          testId: test.id,
          messages: messages.map(serializeTestMessage),
          duration,
        },
      ]);
    },

    errored(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void {
      if (this._ended) return;
      const messages = Array.isArray(message) ? message : [message];
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "errored",
        {
          testId: test.id,
          messages: messages.map(serializeTestMessage),
          duration,
        },
      ]);
    },

    passed(test: TestItem, duration?: number): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunUpdate", [
        controllerId,
        runId,
        "passed",
        {
          testId: test.id,
          duration,
        },
      ]);
    },

    appendOutput(output: string, location?: Location, test?: TestItem): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunOutput", [
        controllerId,
        runId,
        {
          output,
          location: location ? serializeLocation(location) : undefined,
          testId: test?.id,
        },
      ]);
    },

    addCoverage(fileCoverage: FileCoverage): void {
      if (this._ended) return;
      bridge.callMainThread(extensionId, "tests", "testRunCoverage", [
        controllerId,
        runId,
        serializeFileCoverage(fileCoverage),
      ]);
    },

    end(): void {
      if (this._ended) return;
      this._ended = true;
      tokenSource.dispose();
      bridge.callMainThread(extensionId, "tests", "endTestRun", [
        controllerId,
        runId,
      ]);
    },
  };

  // Subscribe to cancellation from main thread
  bridge.subscribeEvent(`tests.${controllerId}.${runId}.cancel`, () => {
    tokenSource.cancel();
  });

  return run;
}

// ============================================================================
// Test Run Profile Implementation
// ============================================================================

function createTestRunProfile(
  extensionId: string,
  controllerId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  label: string,
  kind: TestRunProfileKind,
  runHandler: (request: TestRunRequest, token: CancellationToken) => void | Promise<void>,
  isDefault = false,
  tag?: TestTag
): TestRunProfileInternal {
  const profileId = crypto.randomUUID();

  // Notify main thread
  bridge.callMainThread(extensionId, "tests", "createRunProfile", [
    controllerId,
    profileId,
    {
      label,
      kind,
      isDefault,
      tag: tag ? { id: tag.id } : undefined,
    },
  ]);

  // Store the run handler for invocation
  const runHandlerSubscription = bridge.subscribeEvent(
    `tests.${controllerId}.${profileId}.run`,
    async (data) => {
      const { requestId, include, exclude } = data as {
        requestId: string;
        include?: string[];
        exclude?: string[];
      };

      // We need to get the actual test items from the controller
      // For now, create a request with the IDs - the extension should resolve them
      const tokenSource = new CancellationTokenSource();

      // Create test item stubs from IDs
      const includeItems = include?.map((id) => ({ id } as TestItem));
      const excludeItems = exclude?.map((id) => ({ id } as TestItem));

      const request: TestRunRequest = {
        include: includeItems,
        exclude: excludeItems,
        profile: profile,
      };

      try {
        await runHandler(request, tokenSource.token);
        bridge.callMainThread(extensionId, "tests", "runProfileComplete", [
          controllerId,
          profileId,
          requestId,
          { success: true },
        ]);
      } catch (error) {
        bridge.callMainThread(extensionId, "tests", "runProfileComplete", [
          controllerId,
          profileId,
          requestId,
          { success: false, error: String(error) },
        ]);
      } finally {
        tokenSource.dispose();
      }
    }
  );

  const profile: TestRunProfileInternal = {
    _id: profileId,
    _controllerId: controllerId,

    label,
    kind,
    isDefault,
    tag,
    runHandler,
    configureHandler: undefined,

    dispose(): void {
      runHandlerSubscription.dispose();
      bridge.callMainThread(extensionId, "tests", "disposeRunProfile", [
        controllerId,
        profileId,
      ]);
    },
  };

  disposables.add(profile);
  return profile;
}

// ============================================================================
// Test Controller Implementation
// ============================================================================

function createTestController(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  id: string,
  label: string
): TestController {
  const controllerId = `${extensionId}.${id}`;
  const items = createTestItemCollection(extensionId, controllerId, bridge);
  const profiles = new Map<string, TestRunProfileInternal>();
  const testItemsById = new Map<string, TestItemInternal>();

  // Notify main thread about the new controller
  bridge.callMainThread(extensionId, "tests", "createController", [
    controllerId,
    { id, label },
  ]);

  let resolveHandler: ((item: TestItem | undefined) => void | Promise<void>) | undefined;
  let refreshHandler: ((token: CancellationToken) => void | Promise<void>) | undefined;

  // Subscribe to resolve requests from main thread
  const resolveSubscription = bridge.subscribeEvent(
    `tests.${controllerId}.resolve`,
    async (data) => {
      const { requestId, itemId } = data as { requestId: string; itemId?: string };

      if (resolveHandler) {
        const item = itemId ? testItemsById.get(itemId) : undefined;
        try {
          await resolveHandler(item);
          bridge.callMainThread(extensionId, "tests", "resolveComplete", [
            controllerId,
            requestId,
            { success: true },
          ]);
        } catch (error) {
          bridge.callMainThread(extensionId, "tests", "resolveComplete", [
            controllerId,
            requestId,
            { success: false, error: String(error) },
          ]);
        }
      }
    }
  );

  // Subscribe to refresh requests from main thread
  const refreshSubscription = bridge.subscribeEvent(
    `tests.${controllerId}.refresh`,
    async (data) => {
      const { requestId } = data as { requestId: string };

      if (refreshHandler) {
        const tokenSource = new CancellationTokenSource();
        try {
          await refreshHandler(tokenSource.token);
          bridge.callMainThread(extensionId, "tests", "refreshComplete", [
            controllerId,
            requestId,
            { success: true },
          ]);
        } catch (error) {
          bridge.callMainThread(extensionId, "tests", "refreshComplete", [
            controllerId,
            requestId,
            { success: false, error: String(error) },
          ]);
        } finally {
          tokenSource.dispose();
        }
      }
    }
  );

  const controller: TestController = {
    id: controllerId,
    label,

    get items(): TestItemCollection {
      return items;
    },

    createRunProfile(
      profileLabel: string,
      kind: TestRunProfileKind,
      runHandler: (request: TestRunRequest, token: CancellationToken) => void | Promise<void>,
      isDefault?: boolean,
      tag?: TestTag
    ): TestRunProfile {
      const profile = createTestRunProfile(
        extensionId,
        controllerId,
        bridge,
        disposables,
        profileLabel,
        kind,
        runHandler,
        isDefault,
        tag
      );
      profiles.set(profile._id, profile);
      return profile;
    },

    createTestItem(itemId: string, itemLabel: string, uri?: Uri): TestItem {
      const item = createTestItem(extensionId, controllerId, bridge, itemId, itemLabel, uri);
      testItemsById.set(itemId, item);
      return item;
    },

    createTestRun(request: TestRunRequest, name?: string, persist?: boolean): TestRun {
      return createTestRun(extensionId, controllerId, bridge, request, name, persist);
    },

    invalidateTestResults(testItems?: TestItem | readonly TestItem[]): void {
      const ids = testItems
        ? Array.isArray(testItems)
          ? testItems.map((item) => item.id)
          : [(testItems as TestItem).id]
        : undefined;

      bridge.callMainThread(extensionId, "tests", "invalidateTestResults", [
        controllerId,
        ids,
      ]);
    },

    get resolveHandler(): ((item: TestItem | undefined) => void | Promise<void>) | undefined {
      return resolveHandler;
    },

    set resolveHandler(handler: ((item: TestItem | undefined) => void | Promise<void>) | undefined) {
      resolveHandler = handler;
      bridge.callMainThread(extensionId, "tests", "setResolveHandler", [
        controllerId,
        handler !== undefined,
      ]);
    },

    get refreshHandler(): ((token: CancellationToken) => void | Promise<void>) | undefined {
      return refreshHandler;
    },

    set refreshHandler(handler: ((token: CancellationToken) => void | Promise<void>) | undefined) {
      refreshHandler = handler;
      bridge.callMainThread(extensionId, "tests", "setRefreshHandler", [
        controllerId,
        handler !== undefined,
      ]);
    },

    dispose(): void {
      // Dispose all profiles
      for (const profile of profiles.values()) {
        profile.dispose();
      }
      profiles.clear();

      // Clean up subscriptions
      resolveSubscription.dispose();
      refreshSubscription.dispose();

      // Notify main thread
      bridge.callMainThread(extensionId, "tests", "disposeController", [controllerId]);
    },
  };

  disposables.add(controller);
  return controller;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

function serializeTestItem(item: TestItemInternal): Record<string, unknown> {
  return {
    id: item.id,
    label: item.label,
    uri: item.uri ? item.uri.toString() : undefined,
    description: item.description,
    sortText: item.sortText,
    range: item.range ? serializeRange(item.range) : undefined,
    error: item.error,
    busy: item.busy,
    canResolveChildren: item.canResolveChildren,
    tags: item._tags.map((tag) => ({ id: tag.id })),
    parentId: item._parent?.id,
  };
}

function serializeRange(range: unknown): Record<string, unknown> {
  const r = range as { start: { line: number; character: number }; end: { line: number; character: number } };
  return {
    start: { line: r.start.line, character: r.start.character },
    end: { line: r.end.line, character: r.end.character },
  };
}

function serializeLocation(location: Location): Record<string, unknown> {
  return {
    uri: location.uri.toString(),
    range: serializeRange(location.range),
  };
}

function serializeTestMessage(message: TestMessage): Record<string, unknown> {
  return {
    message: typeof message.message === "string"
      ? message.message
      : { value: (message.message as MarkdownString).value, isTrusted: (message.message as MarkdownString).isTrusted },
    expectedOutput: message.expectedOutput,
    actualOutput: message.actualOutput,
    location: message.location ? serializeLocation(message.location) : undefined,
  };
}

function serializeFileCoverage(coverage: FileCoverage): Record<string, unknown> {
  return {
    uri: coverage.uri.toString(),
    statementCoverage: coverage.statementCoverage,
    branchCoverage: coverage.branchCoverage,
    declarationCoverage: coverage.declarationCoverage,
    detailedCoverage: coverage.detailedCoverage,
  };
}

// ============================================================================
// Tests API Factory
// ============================================================================

/**
 * Create the tests API for an extension.
 */
export function createTestsApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): TestsApi {
  const controllers = new Map<string, TestController>();

  return {
    createTestController(id: string, label: string): TestController {
      const fullId = `${extensionId}.${id}`;

      // Check if controller already exists
      if (controllers.has(fullId)) {
        throw new Error(`Test controller with id '${id}' already exists`);
      }

      const controller = createTestController(extensionId, bridge, disposables, id, label);
      controllers.set(fullId, controller);

      return controller;
    },
  };
}

// ============================================================================
// Test Tag Factory
// ============================================================================

/**
 * Creates a new test tag.
 * @param id Unique identifier for the tag
 * @returns The created test tag
 */
export function createTestTag(id: string): TestTag {
  return { id };
}

// ============================================================================
// Test Message Factory
// ============================================================================

/**
 * Creates a new test message.
 * @param message The message content
 * @returns The created test message
 */
export function createTestMessage(message: string | MarkdownString): TestMessage {
  return { message };
}

/**
 * Creates a test message with diff (expected vs actual).
 * @param message The message content
 * @param expected The expected value
 * @param actual The actual value
 * @returns The created test message with diff
 */
export function createTestMessageDiff(
  message: string | MarkdownString,
  expected: string,
  actual: string
): TestMessage {
  return {
    message,
    expectedOutput: expected,
    actualOutput: actual,
  };
}

// ============================================================================
// Exports for Extension Use
// ============================================================================

// Note: TestsApi is defined in this file
// Other types are exported from "../../types/testing"
