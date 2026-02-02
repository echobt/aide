/**
 * Authentication API for Extensions
 *
 * Provides authentication functionality for extensions running in the sandbox.
 * Implements secure session storage and OAuth flow support.
 */

import type {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  AuthenticationProviderInformation,
  AuthenticationGetSessionOptions,
  AuthenticationSessionsChangeEvent,
  AuthenticationProviderOptions,
  OAuthConfig,
  OAuthState,
  OAuthTokenResponse,
} from "../../types/authentication";

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
} from "../types";

// ============================================================================
// API Bridge Interface (from ExtensionAPI.ts)
// ============================================================================

/**
 * Bridge for communicating with the main thread.
 */
interface ExtensionApiBridge {
  callMainThread<T>(
    extensionId: string,
    namespace: string,
    method: string,
    args: unknown[]
  ): Promise<T>;

  subscribeEvent(
    eventName: string,
    listener: (data: unknown) => void
  ): Disposable;
}

// ============================================================================
// Secure Session Storage
// ============================================================================

/**
 * Encrypted storage key prefix for authentication sessions.
 */
const SESSION_STORAGE_PREFIX = "cortex.auth.sessions.";

/**
 * Secure session storage manager.
 * Handles encrypted storage of authentication sessions.
 */
class SecureSessionStorage {
  private readonly sessions = new Map<string, Map<string, AuthenticationSession>>();
  private readonly bridge: ExtensionApiBridge;
  private readonly extensionId: string;

  constructor(extensionId: string, bridge: ExtensionApiBridge) {
    this.extensionId = extensionId;
    this.bridge = bridge;
  }

  /**
   * Get all sessions for a provider.
   */
  async getSessions(providerId: string): Promise<AuthenticationSession[]> {
    // Try to get from local cache first
    const cached = this.sessions.get(providerId);
    if (cached) {
      return Array.from(cached.values());
    }

    // Fetch from secure storage via main thread
    try {
      const storedSessions = await this.bridge.callMainThread<AuthenticationSession[] | null>(
        this.extensionId,
        "secrets",
        "get",
        [`${SESSION_STORAGE_PREFIX}${providerId}`]
      );

      if (storedSessions) {
        const sessionMap = new Map<string, AuthenticationSession>();
        for (const session of storedSessions) {
          sessionMap.set(session.id, session);
        }
        this.sessions.set(providerId, sessionMap);
        return storedSessions;
      }
    } catch {
      // Storage not available or error
    }

    return [];
  }

  /**
   * Store a session for a provider.
   */
  async storeSession(providerId: string, session: AuthenticationSession): Promise<void> {
    let providerSessions = this.sessions.get(providerId);
    if (!providerSessions) {
      providerSessions = new Map();
      this.sessions.set(providerId, providerSessions);
    }

    providerSessions.set(session.id, session);

    // Persist to secure storage
    await this.persistProviderSessions(providerId);
  }

  /**
   * Remove a session from storage.
   */
  async removeSession(providerId: string, sessionId: string): Promise<AuthenticationSession | undefined> {
    const providerSessions = this.sessions.get(providerId);
    if (!providerSessions) {
      return undefined;
    }

    const session = providerSessions.get(sessionId);
    if (session) {
      providerSessions.delete(sessionId);
      await this.persistProviderSessions(providerId);
    }

    return session;
  }

  /**
   * Clear all sessions for a provider.
   */
  async clearSessions(providerId: string): Promise<void> {
    this.sessions.delete(providerId);
    await this.bridge.callMainThread(
      this.extensionId,
      "secrets",
      "delete",
      [`${SESSION_STORAGE_PREFIX}${providerId}`]
    );
  }

  /**
   * Persist sessions for a provider to secure storage.
   */
  private async persistProviderSessions(providerId: string): Promise<void> {
    const providerSessions = this.sessions.get(providerId);
    const sessionsArray = providerSessions ? Array.from(providerSessions.values()) : [];

    await this.bridge.callMainThread(
      this.extensionId,
      "secrets",
      "store",
      [`${SESSION_STORAGE_PREFIX}${providerId}`, JSON.stringify(sessionsArray)]
    );
  }
}

// ============================================================================
// OAuth Flow Manager
// ============================================================================

/**
 * Manages OAuth authentication flows.
 */
class OAuthFlowManager {
  private readonly pendingFlows = new Map<string, OAuthState>();
  private readonly bridge: ExtensionApiBridge;
  private readonly extensionId: string;

  constructor(extensionId: string, bridge: ExtensionApiBridge) {
    this.extensionId = extensionId;
    this.bridge = bridge;
  }

  /**
   * Generate a cryptographically secure random string.
   */
  private generateRandomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues, (v) => chars[v % chars.length]).join("");
  }

  /**
   * Generate a PKCE code verifier.
   */
  private generateCodeVerifier(): string {
    return this.generateRandomString(64);
  }

  /**
   * Generate a PKCE code challenge from verifier.
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    // Convert to base64url
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * Start an OAuth authorization flow.
   */
  async startAuthorizationFlow(config: OAuthConfig): Promise<string> {
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store the OAuth state
    this.pendingFlows.set(state, {
      state,
      codeVerifier,
      redirectUri: config.redirectUri,
      scopes: config.scope,
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scope.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Add extra params if provided
    if (config.extraParams) {
      for (const [key, value] of Object.entries(config.extraParams)) {
        params.set(key, value);
      }
    }

    const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;

    // Open authorization URL via main thread
    await this.bridge.callMainThread(
      this.extensionId,
      "authentication",
      "openAuthorizationUrl",
      [authUrl]
    );

    return state;
  }

  /**
   * Handle OAuth callback and exchange code for tokens.
   */
  async handleCallback(
    code: string,
    state: string,
    config: OAuthConfig
  ): Promise<OAuthTokenResponse> {
    const flowState = this.pendingFlows.get(state);
    if (!flowState) {
      throw new Error("Invalid or expired OAuth state");
    }

    // Clear the pending flow
    this.pendingFlows.delete(state);

    // Exchange authorization code for tokens
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      code,
      redirect_uri: flowState.redirectUri,
      grant_type: "authorization_code",
      code_verifier: flowState.codeVerifier!,
    });

    if (config.clientSecret) {
      tokenParams.set("client_secret", config.clientSecret);
    }

    const response = await this.bridge.callMainThread<OAuthTokenResponse>(
      this.extensionId,
      "authentication",
      "exchangeToken",
      [config.tokenEndpoint, tokenParams.toString()]
    );

    return response;
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshToken(
    refreshToken: string,
    config: OAuthConfig
  ): Promise<OAuthTokenResponse> {
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    if (config.clientSecret) {
      tokenParams.set("client_secret", config.clientSecret);
    }

    const response = await this.bridge.callMainThread<OAuthTokenResponse>(
      this.extensionId,
      "authentication",
      "exchangeToken",
      [config.tokenEndpoint, tokenParams.toString()]
    );

    return response;
  }

  /**
   * Cancel a pending OAuth flow.
   */
  cancelFlow(state: string): void {
    this.pendingFlows.delete(state);
  }
}

// ============================================================================
// Registered Provider Wrapper
// ============================================================================

/**
 * Wrapper around a registered authentication provider.
 */
interface RegisteredProvider {
  id: string;
  label: string;
  provider: AuthenticationProvider;
  options: AuthenticationProviderOptions;
  disposable: Disposable;
}

// ============================================================================
// Authentication API Implementation
// ============================================================================

/**
 * The Authentication API interface exposed to extensions.
 */
export interface AuthenticationApi {
  /**
   * Get an authentication session matching the provided scopes.
   */
  getSession(
    providerId: string,
    scopes: readonly string[],
    options?: AuthenticationGetSessionOptions
  ): Promise<AuthenticationSession | undefined>;

  /**
   * Register an authentication provider.
   */
  registerAuthenticationProvider(
    id: string,
    label: string,
    provider: AuthenticationProvider,
    options?: AuthenticationProviderOptions
  ): Disposable;

  /**
   * An event that fires when the set of sessions of any provider changes.
   */
  readonly onDidChangeSessions: Event<AuthenticationSessionsChangeEvent>;
}

/**
 * Create the authentication API for an extension.
 */
export function createAuthenticationApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): AuthenticationApi {
  // Registered authentication providers
  const providers = new Map<string, RegisteredProvider>();

  // Session storage
  const sessionStorage = new SecureSessionStorage(extensionId, bridge);

  // OAuth flow manager
  const oauthManager = new OAuthFlowManager(extensionId, bridge);

  // Event emitter for session changes
  const onDidChangeSessionsEmitter = new EventEmitter<AuthenticationSessionsChangeEvent>();
  disposables.add(onDidChangeSessionsEmitter);

  // Subscribe to session change events from main thread
  disposables.add(
    bridge.subscribeEvent("authentication.sessionsChanged", (data) => {
      const event = data as AuthenticationSessionsChangeEvent;
      onDidChangeSessionsEmitter.fire(event);
    })
  );

  // Subscribe to OAuth callbacks from main thread
  disposables.add(
    bridge.subscribeEvent("authentication.oauthCallback", async (data) => {
      const { providerId, code, state } = data as {
        providerId: string;
        code: string;
        state: string;
      };

      const registeredProvider = providers.get(providerId);
      if (registeredProvider) {
        // The provider handles the callback through its createSession
        // This event just notifies that a callback was received
        bridge.callMainThread(
          extensionId,
          "authentication",
          "oauthCallbackReceived",
          [providerId, state]
        );
      }
    })
  );

  /**
   * Check if scopes match (all requested scopes are present).
   */
  function scopesMatch(
    sessionScopes: readonly string[],
    requestedScopes: readonly string[]
  ): boolean {
    return requestedScopes.every((scope) => sessionScopes.includes(scope));
  }

  /**
   * Find an existing session that matches the requested scopes.
   */
  async function findMatchingSession(
    providerId: string,
    scopes: readonly string[]
  ): Promise<AuthenticationSession | undefined> {
    const registeredProvider = providers.get(providerId);
    if (!registeredProvider) {
      // Check if it's a built-in provider handled by main thread
      const sessions = await bridge.callMainThread<AuthenticationSession[]>(
        extensionId,
        "authentication",
        "getSessions",
        [providerId, scopes]
      );
      return sessions.find((s) => scopesMatch(s.scopes, scopes));
    }

    // Get sessions from the registered provider
    const sessions = await registeredProvider.provider.getSessions(scopes);
    return sessions.find((s) => scopesMatch(s.scopes, scopes));
  }

  return {
    async getSession(
      providerId: string,
      scopes: readonly string[],
      options?: AuthenticationGetSessionOptions
    ): Promise<AuthenticationSession | undefined> {
      // Clear session preference if requested
      if (options?.clearSessionPreference) {
        await bridge.callMainThread(
          extensionId,
          "authentication",
          "clearSessionPreference",
          [providerId]
        );
      }

      // If silent mode, only return existing sessions
      if (options?.silent) {
        return findMatchingSession(providerId, scopes);
      }

      // If forcing new session, create one directly
      if (options?.forceNewSession) {
        const registeredProvider = providers.get(providerId);
        if (registeredProvider) {
          const detail = typeof options.forceNewSession === "object"
            ? options.forceNewSession.detail
            : undefined;

          // Show detail message if provided
          if (detail) {
            await bridge.callMainThread(
              extensionId,
              "window",
              "showInformationMessage",
              [detail, undefined, []]
            );
          }

          const session = await registeredProvider.provider.createSession(scopes);
          await sessionStorage.storeSession(providerId, session);
          return session;
        }

        // Delegate to main thread for built-in providers
        return bridge.callMainThread<AuthenticationSession | undefined>(
          extensionId,
          "authentication",
          "createSession",
          [providerId, scopes, { forceNewSession: true }]
        );
      }

      // Try to find an existing session
      let session = await findMatchingSession(providerId, scopes);

      // If no session and createIfNone is true, create one
      if (!session && options?.createIfNone) {
        const registeredProvider = providers.get(providerId);
        if (registeredProvider) {
          // Ask user for permission to sign in
          const choice = await bridge.callMainThread<string | undefined>(
            extensionId,
            "window",
            "showInformationMessage",
            [
              `The extension '${extensionId}' wants to sign in using ${registeredProvider.label}.`,
              { modal: true },
              [{ title: "Allow" }, { title: "Cancel", isCloseAffordance: true }],
            ]
          );

          if (choice === "Allow") {
            session = await registeredProvider.provider.createSession(scopes);
            await sessionStorage.storeSession(providerId, session);
          }
        } else {
          // Delegate to main thread for built-in providers
          session = await bridge.callMainThread<AuthenticationSession | undefined>(
            extensionId,
            "authentication",
            "getSession",
            [providerId, scopes, { createIfNone: true }]
          );
        }
      }

      return session;
    },

    registerAuthenticationProvider(
      id: string,
      label: string,
      provider: AuthenticationProvider,
      options?: AuthenticationProviderOptions
    ): Disposable {
      if (providers.has(id)) {
        throw new Error(`Authentication provider '${id}' is already registered.`);
      }

      const providerOptions: AuthenticationProviderOptions = {
        supportsMultipleAccounts: false,
        ...options,
      };

      // Subscribe to the provider's session change events
      const sessionChangeSubscription = provider.onDidChangeSessions((event) => {
        // Notify main thread about session changes
        bridge.callMainThread(
          extensionId,
          "authentication",
          "onSessionsChanged",
          [id, event]
        );

        // Update local storage
        if (event.added) {
          for (const session of event.added) {
            sessionStorage.storeSession(id, session);
          }
        }
        if (event.removed) {
          for (const session of event.removed) {
            sessionStorage.removeSession(id, session.id);
          }
        }

        // Fire the local event
        onDidChangeSessionsEmitter.fire({
          provider: { id, label },
        });
      });

      // Register provider with main thread
      bridge.callMainThread(
        extensionId,
        "authentication",
        "registerProvider",
        [id, label, providerOptions]
      );

      // Handle getSession requests from main thread
      const getSessionsSub = bridge.subscribeEvent(
        `authentication.${id}.getSessions`,
        async (data) => {
          const { requestId, scopes } = data as { requestId: string; scopes?: string[] };
          try {
            const sessions = await provider.getSessions(scopes);
            bridge.callMainThread(
              extensionId,
              "authentication",
              "getSessionsResponse",
              [requestId, sessions]
            );
          } catch (error) {
            bridge.callMainThread(
              extensionId,
              "authentication",
              "getSessionsResponse",
              [requestId, [], String(error)]
            );
          }
        }
      );

      // Handle createSession requests from main thread
      const createSessionSub = bridge.subscribeEvent(
        `authentication.${id}.createSession`,
        async (data) => {
          const { requestId, scopes } = data as { requestId: string; scopes: string[] };
          try {
            const session = await provider.createSession(scopes);
            await sessionStorage.storeSession(id, session);
            bridge.callMainThread(
              extensionId,
              "authentication",
              "createSessionResponse",
              [requestId, session]
            );
          } catch (error) {
            bridge.callMainThread(
              extensionId,
              "authentication",
              "createSessionResponse",
              [requestId, null, String(error)]
            );
          }
        }
      );

      // Handle removeSession requests from main thread
      const removeSessionSub = bridge.subscribeEvent(
        `authentication.${id}.removeSession`,
        async (data) => {
          const { requestId, sessionId } = data as { requestId: string; sessionId: string };
          try {
            await provider.removeSession(sessionId);
            await sessionStorage.removeSession(id, sessionId);
            bridge.callMainThread(
              extensionId,
              "authentication",
              "removeSessionResponse",
              [requestId, true]
            );
          } catch (error) {
            bridge.callMainThread(
              extensionId,
              "authentication",
              "removeSessionResponse",
              [requestId, false, String(error)]
            );
          }
        }
      );

      // Create the disposable for cleanup
      const disposable = createDisposable(() => {
        providers.delete(id);
        sessionChangeSubscription.dispose();
        getSessionsSub.dispose();
        createSessionSub.dispose();
        removeSessionSub.dispose();
        bridge.callMainThread(
          extensionId,
          "authentication",
          "unregisterProvider",
          [id]
        );
      });

      // Store the registered provider
      const registeredProvider: RegisteredProvider = {
        id,
        label,
        provider,
        options: providerOptions,
        disposable,
      };
      providers.set(id, registeredProvider);

      disposables.add(disposable);
      return disposable;
    },

    onDidChangeSessions: onDidChangeSessionsEmitter.event,
  };
}

// ============================================================================
// Helper Classes for Extension Authors
// ============================================================================

/**
 * Base class for implementing OAuth-based authentication providers.
 * Extensions can extend this class to simplify OAuth provider implementation.
 */
export abstract class BaseOAuthAuthenticationProvider implements AuthenticationProvider {
  protected readonly sessions = new Map<string, AuthenticationSession>();
  protected readonly onDidChangeSessionsEmitter = new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

  readonly onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent> =
    this.onDidChangeSessionsEmitter.event;

  /**
   * Get the OAuth configuration for this provider.
   */
  protected abstract getOAuthConfig(): OAuthConfig;

  /**
   * Get user information from the access token.
   * Should return the account information for the authenticated user.
   */
  protected abstract getUserInfo(accessToken: string): Promise<AuthenticationSessionAccountInformation>;

  /**
   * Generate a unique session ID.
   */
  protected generateSessionId(): string {
    return crypto.randomUUID();
  }

  async getSessions(scopes?: readonly string[]): Promise<readonly AuthenticationSession[]> {
    const allSessions = Array.from(this.sessions.values());
    if (!scopes || scopes.length === 0) {
      return allSessions;
    }
    return allSessions.filter((session) =>
      scopes.every((scope) => session.scopes.includes(scope))
    );
  }

  async createSession(scopes: readonly string[]): Promise<AuthenticationSession> {
    // This method should be overridden to implement the actual OAuth flow
    // The base implementation throws an error
    throw new Error("createSession must be implemented by the provider");
  }

  async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.onDidChangeSessionsEmitter.fire({
        removed: [session],
      });
    }
  }

  /**
   * Add a session to the provider.
   */
  protected addSession(session: AuthenticationSession): void {
    this.sessions.set(session.id, session);
    this.onDidChangeSessionsEmitter.fire({
      added: [session],
    });
  }

  /**
   * Update an existing session.
   */
  protected updateSession(session: AuthenticationSession): void {
    this.sessions.set(session.id, session);
    this.onDidChangeSessionsEmitter.fire({
      changed: [session],
    });
  }

  dispose(): void {
    this.onDidChangeSessionsEmitter.dispose();
  }
}

// ============================================================================
// Exports
// ============================================================================

export type {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  AuthenticationProviderInformation,
  AuthenticationGetSessionOptions,
  AuthenticationSessionsChangeEvent,
  AuthenticationProviderOptions,
  OAuthConfig,
  OAuthState,
  OAuthTokenResponse,
};
