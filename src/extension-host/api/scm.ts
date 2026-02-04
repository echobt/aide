/**
 * Source Control Management (SCM) API
 *
 * Provides the cortex.scm API for extensions to register and manage
 * source control providers. This follows the VS Code SCM API pattern.
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  Uri,
  createUri,
  createDisposable,
  type Command,
} from "../types";

import type { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// SCM Types
// ============================================================================

/**
 * Input box displayed in the source control view for entering commit messages.
 */
export interface SourceControlInputBox {
  /** Current text value of the input box */
  value: string;
  /** Placeholder text shown when empty */
  placeholder: string;
  /** Whether the input box is visible */
  visible: boolean;
  /** Whether the input box is enabled for input */
  enabled: boolean;
  /** Event fired when value changes */
  readonly onDidChange: Event<string>;
}

/**
 * Provider for quick diff gutter decorations.
 * Returns the original version of a resource for comparison.
 */
export interface QuickDiffProvider {
  /**
   * Provides the URI of the original resource for diff comparison.
   * @param uri - The URI of the modified resource
   * @returns The URI of the original resource, or undefined if not available
   */
  provideOriginalResource(uri: Uri): Promise<Uri | undefined>;
}

/**
 * Visual decorations for a source control resource.
 */
export interface SourceControlResourceDecorations {
  /** Display resource with strikethrough text */
  strikeThrough?: boolean;
  /** Display resource with faded text */
  faded?: boolean;
  /** Tooltip text shown on hover */
  tooltip?: string;
  /** Icon path or URI for the resource */
  iconPath?: string | Uri;
  /** Decorations for light themes */
  light?: SourceControlResourceThemableDecorations;
  /** Decorations for dark themes */
  dark?: SourceControlResourceThemableDecorations;
}

/**
 * Theme-specific decorations for source control resources.
 */
export interface SourceControlResourceThemableDecorations {
  /** Icon path or URI for the specific theme */
  iconPath?: string | Uri;
}

/**
 * Represents the state of a single resource in source control.
 */
export interface SourceControlResourceState {
  /** URI of the resource */
  readonly resourceUri: Uri;
  /** Command to execute when the resource is selected */
  command?: Command;
  /** Visual decorations for the resource */
  decorations?: SourceControlResourceDecorations;
  /** Context value for menu contributions */
  contextValue?: string;
}

/**
 * A group of source control resources (e.g., "Staged Changes", "Changes").
 */
export interface SourceControlResourceGroup extends Disposable {
  /** Unique identifier for this group */
  readonly id: string;
  /** Human-readable label displayed in the UI */
  label: string;
  /** Hide the group when it contains no resources */
  hideWhenEmpty?: boolean;
  /** List of resource states in this group */
  resourceStates: SourceControlResourceState[];
}

/**
 * Represents a source control provider instance.
 * Extensions can register their own SCM providers using this interface.
 */
export interface SourceControl extends Disposable {
  /** Unique identifier for this source control instance */
  readonly id: string;
  /** Human-readable label displayed in the UI */
  readonly label: string;
  /** Root URI of the source control repository */
  readonly rootUri: Uri | undefined;
  /** Input box for commit messages */
  readonly inputBox: SourceControlInputBox;
  /** Number of resources with changes */
  count?: number;
  /** Provider for quick diff gutters */
  quickDiffProvider?: QuickDiffProvider;
  /** Template for commit messages */
  commitTemplate?: string;
  /** Command executed when accepting input (e.g., commit) */
  acceptInputCommand?: Command;
  /** Commands shown in the status bar */
  statusBarCommands?: Command[];
  /**
   * Creates a new resource group for organizing changed resources.
   * @param id - Unique identifier for the group
   * @param label - Human-readable label for the group
   * @returns The created resource group
   */
  createResourceGroup(id: string, label: string): SourceControlResourceGroup;
}

// ============================================================================
// SCM API Interface
// ============================================================================

/**
 * Source Control Management API exposed to extensions.
 */
export interface ScmApi {
  /**
   * Input box for the primary source control.
   * Provides a global input box that can be used when no specific
   * source control is selected.
   */
  readonly inputBox: SourceControlInputBox;

  /**
   * Creates a new source control instance.
   * @param id - Unique identifier for the source control
   * @param label - Human-readable label displayed in the UI
   * @param rootUri - Optional root URI of the repository
   * @returns The created source control instance
   */
  createSourceControl(id: string, label: string, rootUri?: Uri): SourceControl;
}

// ============================================================================
// Implementation Classes
// ============================================================================

/**
 * Implementation of SourceControlInputBox.
 */
class SourceControlInputBoxImpl implements SourceControlInputBox {
  private _value = "";
  private _placeholder = "";
  private _visible = true;
  private _enabled = true;
  private readonly _onDidChangeEmitter = new EventEmitter<string>();

  constructor(
    private readonly extensionId: string,
    private readonly bridge: ExtensionApiBridge,
    private readonly sourceControlId: string
  ) {}

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._onDidChangeEmitter.fire(newValue);
      this.bridge.callMainThread(this.extensionId, "scm", "updateInputBox", [
        this.sourceControlId,
        { value: newValue },
      ]);
    }
  }

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(newPlaceholder: string) {
    if (this._placeholder !== newPlaceholder) {
      this._placeholder = newPlaceholder;
      this.bridge.callMainThread(this.extensionId, "scm", "updateInputBox", [
        this.sourceControlId,
        { placeholder: newPlaceholder },
      ]);
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(newVisible: boolean) {
    if (this._visible !== newVisible) {
      this._visible = newVisible;
      this.bridge.callMainThread(this.extensionId, "scm", "updateInputBox", [
        this.sourceControlId,
        { visible: newVisible },
      ]);
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(newEnabled: boolean) {
    if (this._enabled !== newEnabled) {
      this._enabled = newEnabled;
      this.bridge.callMainThread(this.extensionId, "scm", "updateInputBox", [
        this.sourceControlId,
        { enabled: newEnabled },
      ]);
    }
  }

  get onDidChange(): Event<string> {
    return this._onDidChangeEmitter.event;
  }

  /** @internal */
  _setValueFromMainThread(value: string): void {
    if (this._value !== value) {
      this._value = value;
      this._onDidChangeEmitter.fire(value);
    }
  }

  /** @internal */
  dispose(): void {
    this._onDidChangeEmitter.dispose();
  }
}

/**
 * Implementation of SourceControlResourceGroup.
 */
class SourceControlResourceGroupImpl implements SourceControlResourceGroup {
  private _label: string;
  private _hideWhenEmpty = false;
  private _resourceStates: SourceControlResourceState[] = [];
  private _disposed = false;

  constructor(
    public readonly id: string,
    label: string,
    private readonly extensionId: string,
    private readonly bridge: ExtensionApiBridge,
    private readonly sourceControlId: string
  ) {
    this._label = label;
  }

  get label(): string {
    return this._label;
  }

  set label(newLabel: string) {
    if (this._label !== newLabel) {
      this._label = newLabel;
      this.notifyUpdate();
    }
  }

  get hideWhenEmpty(): boolean {
    return this._hideWhenEmpty;
  }

  set hideWhenEmpty(value: boolean) {
    if (this._hideWhenEmpty !== value) {
      this._hideWhenEmpty = value;
      this.notifyUpdate();
    }
  }

  get resourceStates(): SourceControlResourceState[] {
    return this._resourceStates;
  }

  set resourceStates(states: SourceControlResourceState[]) {
    this._resourceStates = states;
    this.notifyUpdate();
  }

  private notifyUpdate(): void {
    if (this._disposed) return;

    // Serialize resource states for IPC
    const serializedStates = this._resourceStates.map((state) => ({
      resourceUri: state.resourceUri.toString(),
      command: state.command,
      decorations: state.decorations
        ? {
            ...state.decorations,
            iconPath:
              typeof state.decorations.iconPath === "string"
                ? state.decorations.iconPath
                : state.decorations.iconPath?.toString(),
            light: state.decorations.light
              ? {
                  iconPath:
                    typeof state.decorations.light.iconPath === "string"
                      ? state.decorations.light.iconPath
                      : state.decorations.light.iconPath?.toString(),
                }
              : undefined,
            dark: state.decorations.dark
              ? {
                  iconPath:
                    typeof state.decorations.dark.iconPath === "string"
                      ? state.decorations.dark.iconPath
                      : state.decorations.dark.iconPath?.toString(),
                }
              : undefined,
          }
        : undefined,
      contextValue: state.contextValue,
    }));

    this.bridge.callMainThread(this.extensionId, "scm", "updateResourceGroup", [
      this.sourceControlId,
      this.id,
      {
        label: this._label,
        hideWhenEmpty: this._hideWhenEmpty,
        resourceStates: serializedStates,
      },
    ]);
  }

  dispose(): void {
    if (!this._disposed) {
      this._disposed = true;
      this.bridge.callMainThread(
        this.extensionId,
        "scm",
        "disposeResourceGroup",
        [this.sourceControlId, this.id]
      );
    }
  }
}

/**
 * Implementation of SourceControl.
 */
class SourceControlImpl implements SourceControl {
  private readonly _inputBox: SourceControlInputBoxImpl;
  private readonly _resourceGroups = new Map<
    string,
    SourceControlResourceGroupImpl
  >();
  private readonly _disposables = new DisposableStore();
  private _disposed = false;

  private _count?: number;
  private _quickDiffProvider?: QuickDiffProvider;
  private _commitTemplate?: string;
  private _acceptInputCommand?: Command;
  private _statusBarCommands?: Command[];

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly rootUri: Uri | undefined,
    private readonly extensionId: string,
    private readonly bridge: ExtensionApiBridge
  ) {
    this._inputBox = new SourceControlInputBoxImpl(
      extensionId,
      bridge,
      id
    );
    this._disposables.add(this._inputBox as unknown as Disposable);

    // Subscribe to input box changes from main thread
    this._disposables.add(
      bridge.subscribeEvent(`scm.${id}.inputBoxChanged`, (data) => {
        const { value } = data as { value: string };
        this._inputBox._setValueFromMainThread(value);
      })
    );

    // Subscribe to quick diff requests from main thread
    this._disposables.add(
      bridge.subscribeEvent(`scm.${id}.provideOriginalResource`, async (data) => {
        const { requestId, uri } = data as { requestId: string; uri: string };
        try {
          if (this._quickDiffProvider) {
            const originalUri = await this._quickDiffProvider.provideOriginalResource(
              createUri(uri)
            );
            bridge.callMainThread(extensionId, "scm", "quickDiffResponse", [
              requestId,
              originalUri?.toString() ?? null,
            ]);
          } else {
            bridge.callMainThread(extensionId, "scm", "quickDiffResponse", [
              requestId,
              null,
            ]);
          }
        } catch (error) {
          bridge.callMainThread(extensionId, "scm", "quickDiffResponse", [
            requestId,
            null,
            String(error),
          ]);
        }
      })
    );
  }

  get inputBox(): SourceControlInputBox {
    return this._inputBox;
  }

  get count(): number | undefined {
    return this._count;
  }

  set count(value: number | undefined) {
    if (this._count !== value) {
      this._count = value;
      this.notifyUpdate();
    }
  }

  get quickDiffProvider(): QuickDiffProvider | undefined {
    return this._quickDiffProvider;
  }

  set quickDiffProvider(provider: QuickDiffProvider | undefined) {
    this._quickDiffProvider = provider;
    this.bridge.callMainThread(this.extensionId, "scm", "setQuickDiffProvider", [
      this.id,
      provider !== undefined,
    ]);
  }

  get commitTemplate(): string | undefined {
    return this._commitTemplate;
  }

  set commitTemplate(value: string | undefined) {
    if (this._commitTemplate !== value) {
      this._commitTemplate = value;
      this.notifyUpdate();
    }
  }

  get acceptInputCommand(): Command | undefined {
    return this._acceptInputCommand;
  }

  set acceptInputCommand(value: Command | undefined) {
    if (this._acceptInputCommand !== value) {
      this._acceptInputCommand = value;
      this.notifyUpdate();
    }
  }

  get statusBarCommands(): Command[] | undefined {
    return this._statusBarCommands;
  }

  set statusBarCommands(value: Command[] | undefined) {
    if (this._statusBarCommands !== value) {
      this._statusBarCommands = value;
      this.notifyUpdate();
    }
  }

  createResourceGroup(id: string, label: string): SourceControlResourceGroup {
    if (this._disposed) {
      throw new Error("SourceControl has been disposed");
    }

    if (this._resourceGroups.has(id)) {
      throw new Error(`Resource group with id '${id}' already exists`);
    }

    const group = new SourceControlResourceGroupImpl(
      id,
      label,
      this.extensionId,
      this.bridge,
      this.id
    );

    this._resourceGroups.set(id, group);

    // Notify main thread about new resource group
    this.bridge.callMainThread(this.extensionId, "scm", "createResourceGroup", [
      this.id,
      id,
      label,
    ]);

    return group;
  }

  private notifyUpdate(): void {
    if (this._disposed) return;

    this.bridge.callMainThread(this.extensionId, "scm", "updateSourceControl", [
      this.id,
      {
        count: this._count,
        commitTemplate: this._commitTemplate,
        acceptInputCommand: this._acceptInputCommand,
        statusBarCommands: this._statusBarCommands,
      },
    ]);
  }

  dispose(): void {
    if (!this._disposed) {
      this._disposed = true;

      // Dispose all resource groups
      for (const group of this._resourceGroups.values()) {
        group.dispose();
      }
      this._resourceGroups.clear();

      // Dispose internal resources
      this._disposables.dispose();

      // Notify main thread
      this.bridge.callMainThread(
        this.extensionId,
        "scm",
        "disposeSourceControl",
        [this.id]
      );
    }
  }
}

// ============================================================================
// Global Input Box
// ============================================================================

/**
 * Global input box implementation for when no specific source control is selected.
 */
class GlobalInputBoxImpl implements SourceControlInputBox {
  private _value = "";
  private _placeholder = "Message";
  private _visible = true;
  private _enabled = true;
  private readonly _onDidChangeEmitter = new EventEmitter<string>();
  private _subscription: Disposable | null = null;

  constructor(
    private readonly extensionId: string,
    private readonly bridge: ExtensionApiBridge
  ) {
    // Subscribe to global input box changes from main thread
    this._subscription = bridge.subscribeEvent("scm.globalInputBoxChanged", (data) => {
      const { value } = data as { value: string };
      if (this._value !== value) {
        this._value = value;
        this._onDidChangeEmitter.fire(value);
      }
    });
  }

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._onDidChangeEmitter.fire(newValue);
      this.bridge.callMainThread(this.extensionId, "scm", "updateGlobalInputBox", [
        { value: newValue },
      ]);
    }
  }

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(newPlaceholder: string) {
    if (this._placeholder !== newPlaceholder) {
      this._placeholder = newPlaceholder;
      this.bridge.callMainThread(this.extensionId, "scm", "updateGlobalInputBox", [
        { placeholder: newPlaceholder },
      ]);
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(newVisible: boolean) {
    if (this._visible !== newVisible) {
      this._visible = newVisible;
      this.bridge.callMainThread(this.extensionId, "scm", "updateGlobalInputBox", [
        { visible: newVisible },
      ]);
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(newEnabled: boolean) {
    if (this._enabled !== newEnabled) {
      this._enabled = newEnabled;
      this.bridge.callMainThread(this.extensionId, "scm", "updateGlobalInputBox", [
        { enabled: newEnabled },
      ]);
    }
  }

  get onDidChange(): Event<string> {
    return this._onDidChangeEmitter.event;
  }

  /** @internal */
  dispose(): void {
    this._subscription?.dispose();
    this._onDidChangeEmitter.dispose();
  }
}

// ============================================================================
// API Factory
// ============================================================================

/**
 * Creates the SCM API for an extension.
 *
 * @param extensionId - The extension identifier
 * @param bridge - The API bridge for main thread communication
 * @param disposables - Disposable store for cleanup
 * @returns The SCM API
 */
export function createScmApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): ScmApi {
  const sourceControls = new Map<string, SourceControlImpl>();
  const globalInputBox = new GlobalInputBoxImpl(extensionId, bridge);

  disposables.add(globalInputBox as unknown as Disposable);

  return {
    get inputBox(): SourceControlInputBox {
      return globalInputBox;
    },

    createSourceControl(
      id: string,
      label: string,
      rootUri?: Uri
    ): SourceControl {
      const fullId = `${extensionId}.${id}`;

      if (sourceControls.has(fullId)) {
        throw new Error(`SourceControl with id '${id}' already exists`);
      }

      const sourceControl = new SourceControlImpl(
        fullId,
        label,
        rootUri,
        extensionId,
        bridge
      );

      sourceControls.set(fullId, sourceControl);

      // Register with main thread
      bridge.callMainThread(extensionId, "scm", "registerSourceControl", [
        fullId,
        label,
        rootUri?.toString(),
      ]);

      // Track disposal
      const disposable = createDisposable(() => {
        sourceControls.delete(fullId);
      });
      disposables.add(disposable);

      // Wrap dispose to also clean up our tracking
      const originalDispose = sourceControl.dispose.bind(sourceControl);
      sourceControl.dispose = () => {
        originalDispose();
        disposable.dispose();
      };

      return sourceControl;
    },
  };
}

// Note: All types are exported at their interface definitions above
