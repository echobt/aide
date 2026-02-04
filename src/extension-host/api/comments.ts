/**
 * Comments API for Cortex IDE Extensions
 *
 * Provides the cortex.comments API for extensions to create and manage
 * comment threads in the editor, similar to VS Code's comments API.
 */

import {
  Disposable,
  DisposableStore,
  Uri,
  createUri,
  Range,
  MarkdownString,
} from "../types";

import { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// Comment Types
// ============================================================================

/**
 * Collapsible state for comment threads.
 */
export enum CommentThreadCollapsibleState {
  /**
   * Determines that the comment thread should be collapsed.
   */
  Collapsed = 0,
  /**
   * Determines that the comment thread should be expanded.
   */
  Expanded = 1,
}

/**
 * The state of a comment thread.
 */
export enum CommentThreadState {
  /**
   * Unresolved thread state.
   */
  Unresolved = 0,
  /**
   * Resolved thread state.
   */
  Resolved = 1,
}

/**
 * Comment mode representing the state of a comment editor.
 */
export enum CommentMode {
  /**
   * Displays the comment editor in editing mode.
   */
  Editing = 0,
  /**
   * Displays the comment editor in preview mode.
   */
  Preview = 1,
}

/**
 * Author information for a comment.
 */
export interface CommentAuthorInformation {
  /**
   * The display name of the author.
   */
  name: string;
  /**
   * An optional icon path for the author's avatar.
   */
  iconPath?: Uri;
}

/**
 * Reactions for a comment.
 */
export interface CommentReaction {
  /**
   * The label for the reaction.
   */
  label: string;
  /**
   * Icon for the reaction (emoji or path).
   */
  iconPath: string | Uri;
  /**
   * The number of users who have reacted with this reaction.
   */
  count: number;
  /**
   * Whether the current user has reacted with this reaction.
   */
  authorHasReacted: boolean;
}

/**
 * A comment in a thread.
 */
export interface Comment {
  /**
   * The content of the comment.
   */
  body: string | MarkdownString;
  /**
   * The mode of the comment (editing or preview).
   */
  mode: CommentMode;
  /**
   * The author of the comment.
   */
  author: CommentAuthorInformation;
  /**
   * Optional context value for when clauses.
   */
  contextValue?: string;
  /**
   * Optional reactions for the comment.
   */
  reactions?: CommentReaction[];
  /**
   * Optional label for the comment (e.g., "pending", "changes requested").
   */
  label?: string;
  /**
   * Optional timestamp for the comment.
   */
  timestamp?: Date;
}

/**
 * Options for a comment thread.
 */
export interface CommentThreadOptions {
  /**
   * Context value for when clauses.
   */
  contextValue?: string;
  /**
   * Label shown in the comment thread header.
   */
  label?: string;
  /**
   * State of the comment thread (resolved/unresolved).
   */
  state?: CommentThreadState;
}

/**
 * A thread of comments on a specific range in a document.
 */
export interface CommentThread extends Disposable {
  /**
   * The URI of the document the thread is associated with.
   */
  readonly uri: Uri;
  /**
   * The range the comment thread is located within the document.
   */
  range: Range;
  /**
   * The ordered comments of the thread.
   */
  comments: readonly Comment[];
  /**
   * Whether the thread supports reply.
   */
  canReply: boolean;
  /**
   * The collapsible state of the thread.
   */
  collapsibleState: CommentThreadCollapsibleState;
  /**
   * Context value for when clauses.
   */
  contextValue?: string;
  /**
   * Label displayed in the comment thread header.
   */
  label?: string;
  /**
   * State of the comment thread.
   */
  state?: CommentThreadState;
}

/**
 * A range provider that determines where commenting is allowed.
 */
export interface CommentingRangeProvider {
  /**
   * Provide commenting ranges for the given document.
   */
  provideCommentingRanges(
    document: { uri: Uri; languageId: string },
    token: { isCancellationRequested: boolean }
  ): Range[] | Promise<Range[]>;
}

/**
 * Options for a comment controller.
 */
export interface CommentControllerOptions {
  /**
   * The commenting range provider for this controller.
   */
  commentingRangeProvider?: CommentingRangeProvider;
  /**
   * An optional reaction handler.
   */
  reactionHandler?: (
    comment: Comment,
    reaction: CommentReaction
  ) => Promise<void>;
}

/**
 * A comment controller manages comment threads and their lifecycle.
 */
export interface CommentController extends Disposable {
  /**
   * The unique identifier of the comment controller.
   */
  readonly id: string;
  /**
   * The human-readable label of the comment controller.
   */
  readonly label: string;
  /**
   * Optional options for the comment controller.
   */
  options?: CommentControllerOptions;
  /**
   * Optional commenting range provider.
   */
  commentingRangeProvider?: CommentingRangeProvider;
  /**
   * An optional reaction handler for comments.
   */
  reactionHandler?: (
    comment: Comment,
    reaction: CommentReaction
  ) => Promise<void>;
  /**
   * Create a comment thread.
   */
  createCommentThread(
    uri: Uri,
    range: Range,
    comments: Comment[]
  ): CommentThread;
}

// ============================================================================
// Comments API
// ============================================================================

/**
 * The comments API exposed to extensions.
 */
export interface CommentsApi {
  /**
   * Create a new comment controller.
   * 
   * @param id A unique identifier for the comment controller.
   * @param label A human-readable label for the comment controller.
   * @returns A new comment controller.
   */
  createCommentController(id: string, label: string): CommentController;
}

/**
 * Internal state for a comment thread.
 * @internal Reserved for future use
 */
// @ts-expect-error Reserved for future use
interface CommentThreadInternalState {
  id: string;
  uri: Uri;
  range: Range;
  comments: Comment[];
  canReply: boolean;
  collapsibleState: CommentThreadCollapsibleState;
  contextValue?: string;
  label?: string;
  state?: CommentThreadState;
  disposed: boolean;
}

/**
 * Create the comments API.
 */
export function createCommentsApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): CommentsApi {
  const controllers = new Map<string, CommentController>();

  return {
    createCommentController(id: string, label: string): CommentController {
      const controllerId = `${extensionId}.comments.${id}`;
      
      // Check if controller already exists
      if (controllers.has(controllerId)) {
        throw new Error(`Comment controller with id '${id}' already exists`);
      }

      const threads = new Map<string, CommentThreadImpl>();
      let threadIdCounter = 0;
      let commentingRangeProvider: CommentingRangeProvider | undefined;
      let reactionHandler: ((comment: Comment, reaction: CommentReaction) => Promise<void>) | undefined;
      let controllerOptions: CommentControllerOptions | undefined;

      // Register controller with main thread
      bridge.callMainThread(extensionId, "comments", "registerController", [
        controllerId,
        label,
      ]);

      // Subscribe to commenting range requests
      const rangeSub = bridge.subscribeEvent(
        `comments.${controllerId}.provideCommentingRanges`,
        async (data) => {
          const { requestId, document, token } = data as {
            requestId: string;
            document: { uri: string; languageId: string };
            token: { isCancellationRequested: boolean };
          };

          try {
            if (commentingRangeProvider) {
              const doc = {
                uri: createUri(document.uri),
                languageId: document.languageId,
              };
              const ranges = await commentingRangeProvider.provideCommentingRanges(doc, token);
              bridge.callMainThread(extensionId, "comments", "commentingRangesResponse", [
                requestId,
                ranges ? serializeRanges(ranges) : null,
              ]);
            } else {
              bridge.callMainThread(extensionId, "comments", "commentingRangesResponse", [
                requestId,
                null,
              ]);
            }
          } catch (error) {
            bridge.callMainThread(extensionId, "comments", "commentingRangesResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      // Subscribe to reaction events
      const reactionSub = bridge.subscribeEvent(
        `comments.${controllerId}.handleReaction`,
        async (data) => {
          const { requestId, comment, reaction } = data as {
            requestId: string;
            comment: Comment;
            reaction: CommentReaction;
          };

          try {
            if (reactionHandler) {
              await reactionHandler(comment, reaction);
              bridge.callMainThread(extensionId, "comments", "reactionResponse", [
                requestId,
                true,
              ]);
            } else {
              bridge.callMainThread(extensionId, "comments", "reactionResponse", [
                requestId,
                false,
                "No reaction handler registered",
              ]);
            }
          } catch (error) {
            bridge.callMainThread(extensionId, "comments", "reactionResponse", [
              requestId,
              false,
              String(error),
            ]);
          }
        }
      );

      /**
       * Internal implementation of CommentThread.
       */
      class CommentThreadImpl implements CommentThread {
        private _id: string;
        private _uri: Uri;
        private _range: Range;
        private _comments: Comment[];
        private _canReply: boolean;
        private _collapsibleState: CommentThreadCollapsibleState;
        private _contextValue?: string;
        private _label?: string;
        private _state?: CommentThreadState;
        private _disposed: boolean = false;

        constructor(
          uri: Uri,
          range: Range,
          comments: Comment[]
        ) {
          this._id = `${controllerId}.thread.${++threadIdCounter}`;
          this._uri = uri;
          this._range = range;
          this._comments = [...comments];
          this._canReply = true;
          this._collapsibleState = CommentThreadCollapsibleState.Expanded;

          // Register thread with main thread
          bridge.callMainThread(extensionId, "comments", "createThread", [
            this._id,
            controllerId,
            uri.toString(),
            serializeRange(range),
            this._comments.map(serializeComment),
          ]);

          threads.set(this._id, this);
        }

        get uri(): Uri {
          return this._uri;
        }

        get range(): Range {
          return this._range;
        }

        set range(value: Range) {
          if (this._disposed) return;
          this._range = value;
          this._notifyUpdate();
        }

        get comments(): readonly Comment[] {
          return this._comments;
        }

        set comments(value: readonly Comment[]) {
          if (this._disposed) return;
          this._comments = [...value];
          this._notifyUpdate();
        }

        get canReply(): boolean {
          return this._canReply;
        }

        set canReply(value: boolean) {
          if (this._disposed) return;
          this._canReply = value;
          this._notifyUpdate();
        }

        get collapsibleState(): CommentThreadCollapsibleState {
          return this._collapsibleState;
        }

        set collapsibleState(value: CommentThreadCollapsibleState) {
          if (this._disposed) return;
          this._collapsibleState = value;
          this._notifyUpdate();
        }

        get contextValue(): string | undefined {
          return this._contextValue;
        }

        set contextValue(value: string | undefined) {
          if (this._disposed) return;
          this._contextValue = value;
          this._notifyUpdate();
        }

        get label(): string | undefined {
          return this._label;
        }

        set label(value: string | undefined) {
          if (this._disposed) return;
          this._label = value;
          this._notifyUpdate();
        }

        get state(): CommentThreadState | undefined {
          return this._state;
        }

        set state(value: CommentThreadState | undefined) {
          if (this._disposed) return;
          this._state = value;
          this._notifyUpdate();
        }

        private _notifyUpdate(): void {
          if (this._disposed) return;
          bridge.callMainThread(extensionId, "comments", "updateThread", [
            this._id,
            {
              range: serializeRange(this._range),
              comments: this._comments.map(serializeComment),
              canReply: this._canReply,
              collapsibleState: this._collapsibleState,
              contextValue: this._contextValue,
              label: this._label,
              state: this._state,
            },
          ]);
        }

        dispose(): void {
          if (this._disposed) return;
          this._disposed = true;
          threads.delete(this._id);
          bridge.callMainThread(extensionId, "comments", "disposeThread", [this._id]);
        }
      }

      const controller: CommentController = {
        id,
        label,

        get options(): CommentControllerOptions | undefined {
          return controllerOptions;
        },

        set options(value: CommentControllerOptions | undefined) {
          controllerOptions = value;
          if (value?.commentingRangeProvider) {
            commentingRangeProvider = value.commentingRangeProvider;
          }
          if (value?.reactionHandler) {
            reactionHandler = value.reactionHandler;
          }
          // Notify main thread about options change
          bridge.callMainThread(extensionId, "comments", "updateControllerOptions", [
            controllerId,
            {
              hasCommentingRangeProvider: !!commentingRangeProvider,
              hasReactionHandler: !!reactionHandler,
            },
          ]);
        },

        get commentingRangeProvider(): CommentingRangeProvider | undefined {
          return commentingRangeProvider;
        },

        set commentingRangeProvider(value: CommentingRangeProvider | undefined) {
          commentingRangeProvider = value;
          bridge.callMainThread(extensionId, "comments", "updateControllerOptions", [
            controllerId,
            { hasCommentingRangeProvider: !!value },
          ]);
        },

        get reactionHandler(): ((comment: Comment, reaction: CommentReaction) => Promise<void>) | undefined {
          return reactionHandler;
        },

        set reactionHandler(
          value: ((comment: Comment, reaction: CommentReaction) => Promise<void>) | undefined
        ) {
          reactionHandler = value;
          bridge.callMainThread(extensionId, "comments", "updateControllerOptions", [
            controllerId,
            { hasReactionHandler: !!value },
          ]);
        },

        createCommentThread(
          uri: Uri,
          range: Range,
          comments: Comment[]
        ): CommentThread {
          return new CommentThreadImpl(uri, range, comments);
        },

        dispose(): void {
          // Dispose all threads
          for (const thread of threads.values()) {
            thread.dispose();
          }
          threads.clear();

          // Unsubscribe from events
          rangeSub.dispose();
          reactionSub.dispose();

          // Unregister controller
          controllers.delete(controllerId);
          bridge.callMainThread(extensionId, "comments", "unregisterController", [
            controllerId,
          ]);
        },
      };

      controllers.set(controllerId, controller);
      disposables.add(controller);

      return controller;
    },
  };
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize a Range for IPC.
 */
function serializeRange(range: Range): {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
} {
  return {
    startLine: range.start.line,
    startCharacter: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character,
  };
}

/**
 * Serialize multiple Ranges for IPC.
 */
function serializeRanges(ranges: Range[]): Array<{
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}> {
  return ranges.map(serializeRange);
}

/**
 * Serialize a Comment for IPC.
 */
function serializeComment(comment: Comment): {
  body: string | { value: string; isTrusted?: boolean };
  mode: CommentMode;
  author: { name: string; iconPath?: string };
  contextValue?: string;
  reactions?: Array<{
    label: string;
    iconPath: string;
    count: number;
    authorHasReacted: boolean;
  }>;
  label?: string;
  timestamp?: string;
} {
  return {
    body: typeof comment.body === "string"
      ? comment.body
      : { value: comment.body.value, isTrusted: comment.body.isTrusted as boolean | undefined },
    mode: comment.mode,
    author: {
      name: comment.author.name,
      iconPath: comment.author.iconPath?.toString(),
    },
    contextValue: comment.contextValue,
    reactions: comment.reactions?.map((r) => ({
      label: r.label,
      iconPath: typeof r.iconPath === "string" ? r.iconPath : r.iconPath.toString(),
      count: r.count,
      authorHasReacted: r.authorHasReacted,
    })),
    label: comment.label,
    timestamp: comment.timestamp?.toISOString(),
  };
}

// Enums are already exported above at their declarations
