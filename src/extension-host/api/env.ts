/**
 * Environment API for Cortex Extensions
 *
 * Provides environment information and utilities to extensions,
 * following the VS Code extension API patterns for cortex.env namespace.
 */

import {
  DisposableStore,
  EventEmitter,
  Event,
  Uri,
  createUri,
} from "../types";
import { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// Clipboard API
// ============================================================================

/**
 * Clipboard interface for reading and writing text.
 */
export interface Clipboard {
  /**
   * Read the current clipboard contents as text.
   * @returns A promise that resolves to the clipboard text.
   */
  readText(): Promise<string>;

  /**
   * Write text to the clipboard.
   * @param value The text to write to the clipboard.
   * @returns A promise that resolves when the text has been written.
   */
  writeText(value: string): Promise<void>;
}

// ============================================================================
// Environment API Interface
// ============================================================================

/**
 * Namespace for environment-related functionality exposed to extensions.
 * Accessible via `cortex.env`.
 */
export interface EnvApi {
  /**
   * The application name.
   * Always returns "Cortex".
   */
  readonly appName: string;

  /**
   * The application root path.
   * The path of the directory containing the application.
   */
  readonly appRoot: string;

  /**
   * The host application identifier.
   * Used to identify the application hosting the extension.
   * Examples: "desktop", "web", "codespace".
   */
  readonly appHost: string;

  /**
   * The custom URI scheme used by the application.
   * Always returns "cortex".
   */
  readonly uriScheme: string;

  /**
   * The detected UI language of the application.
   * Returns a BCP 47 language tag (e.g., "en-US", "fr-FR").
   */
  readonly language: string;

  /**
   * Clipboard interface for text operations.
   */
  readonly clipboard: Clipboard;

  /**
   * A unique identifier for the machine.
   * This ID is generated once per machine installation and persists
   * across sessions. Used for anonymous usage tracking when telemetry
   * is enabled.
   */
  readonly machineId: string;

  /**
   * A unique identifier for the current session.
   * Changes with each new application session.
   */
  readonly sessionId: string;

  /**
   * Indicates whether this is a new application installation.
   * Returns `true` if this is the first time the application is running
   * after a fresh install. Can be used for first-run experiences.
   */
  readonly isNewAppInstall: boolean;

  /**
   * Indicates whether telemetry is currently enabled.
   * Extensions should respect this setting and avoid sending
   * telemetry data when `false`.
   */
  readonly isTelemetryEnabled: boolean;

  /**
   * Event fired when telemetry enabled state changes.
   * Extensions should listen to this event and update their
   * telemetry behavior accordingly.
   */
  readonly onDidChangeTelemetryEnabled: Event<boolean>;

  /**
   * Opens a URI externally using the default application.
   * For example, opens HTTP URLs in the default browser,
   * mailto: links in the default email client, etc.
   *
   * @param target The URI to open externally.
   * @returns A promise that resolves to `true` if the URI was opened successfully.
   *
   * @example
   * ```typescript
   * // Open documentation in browser
   * await cortex.env.openExternal(cortex.Uri.parse('https://cortex.dev/docs'));
   *
   * // Open email client
   * await cortex.env.openExternal(cortex.Uri.parse('mailto:support@cortex.dev'));
   * ```
   */
  openExternal(target: Uri): Promise<boolean>;

  /**
   * Resolves an external URI, such as a `http:` or `https:` link,
   * from where the extension is running to a URI for the same
   * resource on the client machine.
   *
   * This is particularly useful for remote development scenarios
   * where the extension host runs in a different environment than
   * the user interface.
   *
   * @param target The URI to resolve as an external URI.
   * @returns A promise that resolves to the external URI.
   *
   * @example
   * ```typescript
   * // Convert a localhost URL to be accessible externally
   * const localServer = cortex.Uri.parse('http://localhost:3000');
   * const externalUri = await cortex.env.asExternalUri(localServer);
   * // In remote scenarios, might return 'https://user-abc123.cortex.dev:3000'
   * ```
   */
  asExternalUri(target: Uri): Promise<Uri>;
}

// ============================================================================
// Environment API Configuration
// ============================================================================

/**
 * Configuration options for initializing the environment API.
 */
export interface EnvApiConfig {
  /**
   * The application root path.
   */
  appRoot: string;

  /**
   * The application host identifier (e.g., "desktop", "web").
   */
  appHost: string;

  /**
   * The detected UI language.
   */
  language: string;

  /**
   * The unique machine identifier.
   */
  machineId: string;

  /**
   * The current session identifier.
   */
  sessionId: string;

  /**
   * Whether this is a new installation.
   */
  isNewAppInstall: boolean;

  /**
   * Initial telemetry enabled state.
   */
  isTelemetryEnabled: boolean;
}

// ============================================================================
// Environment API Implementation
// ============================================================================

/**
 * Creates the Clipboard implementation.
 */
function createClipboard(
  extensionId: string,
  bridge: ExtensionApiBridge
): Clipboard {
  return {
    async readText(): Promise<string> {
      return bridge.callMainThread<string>(
        extensionId,
        "env",
        "clipboardReadText",
        []
      );
    },

    async writeText(value: string): Promise<void> {
      await bridge.callMainThread<void>(
        extensionId,
        "env",
        "clipboardWriteText",
        [value]
      );
    },
  };
}

/**
 * Creates the complete environment API for an extension.
 *
 * @param extensionId - The unique identifier of the extension.
 * @param bridge - The bridge for communicating with the main thread.
 * @param disposables - Store for managing disposable resources.
 * @param config - Configuration options for the environment.
 * @returns The environment API instance.
 */
export function createEnvApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  config: EnvApiConfig
): EnvApi {
  // Track current telemetry state
  let currentTelemetryEnabled = config.isTelemetryEnabled;

  // Event emitter for telemetry state changes
  const onDidChangeTelemetryEnabledEmitter = new EventEmitter<boolean>();
  disposables.add(onDidChangeTelemetryEnabledEmitter);

  // Subscribe to telemetry state changes from main thread
  disposables.add(
    bridge.subscribeEvent("env.telemetryEnabledChanged", (data) => {
      const enabled = data as boolean;
      if (currentTelemetryEnabled !== enabled) {
        currentTelemetryEnabled = enabled;
        onDidChangeTelemetryEnabledEmitter.fire(enabled);
      }
    })
  );

  // Create the clipboard instance
  const clipboard = createClipboard(extensionId, bridge);

  return {
    // Static application information
    get appName(): string {
      return "Cortex";
    },

    get appRoot(): string {
      return config.appRoot;
    },

    get appHost(): string {
      return config.appHost;
    },

    get uriScheme(): string {
      return "cortex";
    },

    get language(): string {
      return config.language;
    },

    // Clipboard access
    get clipboard(): Clipboard {
      return clipboard;
    },

    // Machine and session identifiers
    get machineId(): string {
      return config.machineId;
    },

    get sessionId(): string {
      return config.sessionId;
    },

    // Installation state
    get isNewAppInstall(): boolean {
      return config.isNewAppInstall;
    },

    // Telemetry
    get isTelemetryEnabled(): boolean {
      return currentTelemetryEnabled;
    },

    onDidChangeTelemetryEnabled: onDidChangeTelemetryEnabledEmitter.event,

    // External URI operations
    async openExternal(target: Uri): Promise<boolean> {
      try {
        return await bridge.callMainThread<boolean>(
          extensionId,
          "env",
          "openExternal",
          [target.toString()]
        );
      } catch (error) {
        // Log error but don't throw - return false for failed open
        bridge.log(
          extensionId,
          2, // LogLevel.Warning
          `Failed to open external URI: ${target.toString()}`,
          error
        );
        return false;
      }
    },

    async asExternalUri(target: Uri): Promise<Uri> {
      const result = await bridge.callMainThread<string>(
        extensionId,
        "env",
        "asExternalUri",
        [target.toString()]
      );
      return createUri(result);
    },
  };
}

// ============================================================================
// Default Configuration Factory
// ============================================================================

/**
 * Creates a default environment configuration.
 * Useful for testing or when specific values aren't available.
 */
export function createDefaultEnvConfig(): EnvApiConfig {
  return {
    appRoot: "",
    appHost: "desktop",
    language: typeof navigator !== "undefined" ? navigator.language : "en-US",
    machineId: generateUUID(),
    sessionId: generateUUID(),
    isNewAppInstall: false,
    isTelemetryEnabled: false,
  };
}

/**
 * Generates a UUID v4.
 * Used for machine and session identifiers.
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Type Exports
// ============================================================================

export type { Clipboard, EnvApi, EnvApiConfig };
