/**
 * Localization (l10n) API for Cortex IDE Extensions
 *
 * Provides the cortex.l10n namespace for extensions to implement
 * localization and internationalization support.
 *
 * Features:
 * - Message translation with positional and named argument substitution
 * - Bundle loading from JSON files
 * - Support for ICU message format patterns
 * - Fallback to original message when translation not found
 */

import {
  DisposableStore,
  Uri,
  createUri,
} from "../types";

// ============================================================================
// L10n Types
// ============================================================================

/**
 * A message that can be localized.
 * Supports both simple strings and complex message objects with metadata.
 */
export interface L10nMessage {
  /**
   * The message key or template.
   * This can be either a literal string or a key that maps to a translation.
   */
  message: string;

  /**
   * Arguments to substitute into the message.
   * Can be positional (array) or named (object).
   *
   * @example
   * // Positional: "Hello {0}, you have {1} messages"
   * args: ["John", 5]
   *
   * @example
   * // Named: "Hello {name}, you have {count} messages"
   * args: { name: "John", count: 5 }
   */
  args?: Record<string, string | number | boolean> | (string | number | boolean)[];

  /**
   * Optional comment for translators.
   * Provides context about how the message is used.
   */
  comment?: string | string[];
}

/**
 * Bundle of localized strings loaded from a JSON file.
 *
 * Bundle format supports two structures:
 * 1. Simple: { "key": "translation" }
 * 2. VS Code style: { "key": { "message": "translation", "comment": "..." } }
 */
export interface L10nBundle {
  /**
   * The contents of the bundle - mapping of keys to translated strings.
   */
  contents: Record<string, string>;

  /**
   * The URI of the bundle file, if loaded from disk.
   */
  uri?: Uri;
}

/**
 * Raw bundle format as loaded from JSON file.
 * Supports both simple string values and objects with message/comment.
 */
export interface L10nBundleRaw {
  [key: string]: string | { message: string; comment?: string | string[] };
}

// ============================================================================
// L10n API
// ============================================================================

/**
 * The l10n API exposed to extensions via cortex.l10n namespace.
 *
 * Provides localization capabilities following VS Code's l10n API pattern.
 *
 * @example
 * ```typescript
 * // Simple translation
 * const greeting = cortex.l10n.t("Hello World");
 *
 * // With positional arguments
 * const message = cortex.l10n.t("Hello {0}, welcome to {1}!", userName, appName);
 *
 * // With named arguments
 * const status = cortex.l10n.t("You have {count} new messages", { count: 5 });
 *
 * // Using message object
 * const complex = cortex.l10n.t({
 *   message: "File {name} saved successfully",
 *   args: { name: "document.txt" },
 *   comment: "Shown when a file is saved"
 * });
 * ```
 */
export interface L10nApi {
  /**
   * The current language/locale (BCP 47 tag, e.g., "en-US", "fr-FR").
   */
  readonly language: string;

  /**
   * The bundle loaded from the extension, if any.
   * Contains all translated strings for the current locale.
   */
  readonly bundle: L10nBundle | undefined;

  /**
   * The URI of the localization bundle file.
   * Useful for debugging and determining which translations are loaded.
   */
  readonly uri: Uri | undefined;

  /**
   * Translates a message with positional arguments.
   *
   * @param message The message to translate. Can be a literal string or a key.
   * @param args Positional arguments to substitute into the message.
   * @returns The translated and formatted message.
   *
   * @example
   * cortex.l10n.t("Hello {0}!", "World") // "Hello World!"
   * cortex.l10n.t("Item {0} of {1}", 1, 10) // "Item 1 of 10"
   */
  t(message: string, ...args: (string | number | boolean)[]): string;

  /**
   * Translates a message with named arguments.
   *
   * @param message The message to translate. Can be a literal string or a key.
   * @param args Named arguments object to substitute into the message.
   * @returns The translated and formatted message.
   *
   * @example
   * cortex.l10n.t("Hello {name}!", { name: "World" }) // "Hello World!"
   * cortex.l10n.t("{count} items selected", { count: 5 }) // "5 items selected"
   */
  t(message: string, args: Record<string, string | number | boolean>): string;

  /**
   * Translates a message object with full options.
   *
   * @param options The message options including message, args, and comments.
   * @returns The translated and formatted message.
   *
   * @example
   * cortex.l10n.t({
   *   message: "Save {filename}?",
   *   args: { filename: "document.txt" },
   *   comment: "Confirmation dialog title"
   * })
   */
  t(options: L10nMessage): string;
}

// ============================================================================
// L10n Implementation
// ============================================================================

/**
 * Configuration for the l10n API.
 */
export interface L10nConfig {
  /**
   * The extension's language bundle.
   */
  bundle?: L10nBundle;

  /**
   * The current language (BCP 47 tag).
   */
  language: string;

  /**
   * Path to the extension's l10n directory.
   * Used for loading locale-specific bundles.
   */
  l10nPath?: string;
}

/**
 * Options for loading a bundle.
 */
export interface LoadBundleOptions {
  /**
   * The base path to the l10n directory.
   */
  basePath: string;

  /**
   * The target language to load.
   */
  language: string;

  /**
   * File system read function.
   */
  readFile: (path: string) => Promise<string>;
}

/**
 * Format a message by substituting arguments.
 *
 * Supports two formats:
 * - Positional: {0}, {1}, {2}, etc.
 * - Named: {name}, {count}, {value}, etc.
 *
 * @param message The message template.
 * @param args The arguments to substitute.
 * @returns The formatted message.
 */
export function formatMessage(
  message: string,
  args?: Record<string, string | number | boolean> | (string | number | boolean)[]
): string {
  if (!args) {
    return message;
  }

  if (Array.isArray(args)) {
    // Positional arguments: {0}, {1}, etc.
    return message.replace(/\{(\d+)\}/g, (match, index) => {
      const argIndex = parseInt(index, 10);
      if (argIndex >= 0 && argIndex < args.length) {
        return String(args[argIndex]);
      }
      return match;
    });
  } else {
    // Named arguments: {name}, {count}, etc.
    return message.replace(/\{(\w+)\}/g, (match, name) => {
      if (Object.prototype.hasOwnProperty.call(args, name)) {
        return String(args[name]);
      }
      return match;
    });
  }
}

/**
 * Normalize a raw bundle into a simple key-value format.
 * Handles both simple strings and VS Code-style message objects.
 *
 * @param raw The raw bundle data.
 * @returns Normalized bundle contents.
 */
export function normalizeBundleContents(
  raw: L10nBundleRaw
): Record<string, string> {
  const contents: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      contents[key] = value;
    } else if (value && typeof value === "object" && "message" in value) {
      contents[key] = value.message;
    }
  }

  return contents;
}

/**
 * Determine the bundle file path for a given language.
 *
 * Follows VS Code's l10n file naming convention:
 * - bundle.l10n.json (default/fallback)
 * - bundle.l10n.{language}.json (e.g., bundle.l10n.fr.json)
 * - bundle.l10n.{language-region}.json (e.g., bundle.l10n.zh-cn.json)
 *
 * @param basePath Base path to the l10n directory.
 * @param language Target language code.
 * @returns Array of potential bundle file paths to try.
 */
export function getBundleFilePaths(basePath: string, language: string): string[] {
  const paths: string[] = [];
  const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/$/, "");

  // Normalize language code (e.g., "en-US" -> "en-us")
  const normalizedLang = language.toLowerCase();

  // Try exact match first (e.g., "zh-cn")
  paths.push(`${normalizedBase}/bundle.l10n.${normalizedLang}.json`);

  // Try base language (e.g., "zh" from "zh-cn")
  const baseLang = normalizedLang.split("-")[0];
  if (baseLang !== normalizedLang) {
    paths.push(`${normalizedBase}/bundle.l10n.${baseLang}.json`);
  }

  // Fallback to default bundle
  paths.push(`${normalizedBase}/bundle.l10n.json`);

  return paths;
}

/**
 * Load a localization bundle from the file system.
 *
 * @param options Bundle loading options.
 * @returns The loaded bundle or undefined if not found.
 */
export async function loadBundle(
  options: LoadBundleOptions
): Promise<L10nBundle | undefined> {
  const { basePath, language, readFile } = options;
  const paths = getBundleFilePaths(basePath, language);

  for (const path of paths) {
    try {
      const content = await readFile(path);
      const raw = JSON.parse(content) as L10nBundleRaw;
      const contents = normalizeBundleContents(raw);

      return {
        contents,
        uri: createUri(path),
      };
    } catch {
      // Try next path
      continue;
    }
  }

  return undefined;
}

/**
 * Create the l10n API for an extension.
 *
 * @param extensionId The extension's unique identifier.
 * @param bridge The API bridge for main thread communication.
 * @param disposables Store for disposable resources.
 * @param config L10n configuration.
 * @returns The L10n API instance.
 */
export function createL10nApi(
  _extensionId: string,
  _bridge: unknown,
  _disposables: DisposableStore,
  config: L10nConfig
): L10nApi {
  // Cache for loaded translations
  const translations = new Map<string, string>();

  // Load bundle contents into cache
  if (config.bundle?.contents) {
    for (const [key, value] of Object.entries(config.bundle.contents)) {
      translations.set(key, value);
    }
  }

  /**
   * Get the translation for a message key.
   * Falls back to the original key if no translation is found.
   */
  function getTranslation(key: string): string {
    return translations.get(key) ?? key;
  }

  // The l10n API object
  const l10nApi: L10nApi = {
    get language(): string {
      return config.language;
    },

    get bundle(): L10nBundle | undefined {
      return config.bundle;
    },

    get uri(): Uri | undefined {
      return config.bundle?.uri;
    },

    t(
      messageOrOptions: string | L10nMessage,
      ...args: (string | number | boolean | Record<string, string | number | boolean>)[]
    ): string {
      let message: string;
      let formatArgs: Record<string, string | number | boolean> | (string | number | boolean)[] | undefined;

      if (typeof messageOrOptions === "string") {
        message = messageOrOptions;

        // Check if first arg is a named args object
        if (
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          !Array.isArray(args[0])
        ) {
          formatArgs = args[0] as Record<string, string | number | boolean>;
        } else if (args.length > 0) {
          formatArgs = args as (string | number | boolean)[];
        }
      } else {
        // L10nMessage object
        message = messageOrOptions.message;
        formatArgs = messageOrOptions.args;
      }

      // Look up translation
      const translatedMessage = getTranslation(message);

      // Format with arguments
      return formatMessage(translatedMessage, formatArgs);
    },
  };

  return l10nApi;
}

// ============================================================================
// Bundle Loading Utilities
// ============================================================================

/**
 * Create a default l10n configuration.
 * Detects the current language from the browser/environment.
 */
export function createDefaultL10nConfig(): L10nConfig {
  return {
    language: detectLanguage(),
    bundle: undefined,
  };
}

/**
 * Detect the current language from the environment.
 *
 * @returns BCP 47 language tag.
 */
export function detectLanguage(): string {
  // Browser environment
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  // Node.js environment
  if (typeof process !== "undefined" && process.env) {
    const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;
    if (envLang) {
      // Parse LANG format (e.g., "en_US.UTF-8" -> "en-US")
      const match = envLang.match(/^([a-z]{2})_?([A-Z]{2})?/i);
      if (match) {
        return match[2] ? `${match[1]}-${match[2]}` : match[1];
      }
    }
  }

  return "en";
}

/**
 * Load a bundle from JSON content directly.
 *
 * @param json The bundle JSON content (raw or normalized).
 * @param uri Optional URI of the source file.
 * @returns The loaded bundle.
 */
export function loadBundleFromJson(
  json: Record<string, string> | L10nBundleRaw,
  uri?: Uri
): L10nBundle {
  // Check if this is a raw bundle with message objects
  const firstValue = Object.values(json)[0];
  const isRaw = firstValue && typeof firstValue === "object" && "message" in firstValue;

  const contents = isRaw
    ? normalizeBundleContents(json as L10nBundleRaw)
    : (json as Record<string, string>);

  return {
    contents,
    uri,
  };
}

/**
 * Create a bundle from a key-value map.
 *
 * @param map The translations map.
 * @param uri Optional URI of the source.
 * @returns The bundle.
 */
export function createBundle(
  map: Map<string, string> | Record<string, string>,
  uri?: Uri
): L10nBundle {
  const contents: Record<string, string> = {};

  if (map instanceof Map) {
    for (const [key, value] of map) {
      contents[key] = value;
    }
  } else {
    Object.assign(contents, map);
  }

  return { contents, uri };
}

/**
 * Merge multiple bundles into one.
 * Later bundles override earlier ones for duplicate keys.
 *
 * @param bundles The bundles to merge.
 * @returns The merged bundle.
 */
export function mergeBundles(...bundles: (L10nBundle | undefined)[]): L10nBundle {
  const contents: Record<string, string> = {};
  let lastUri: Uri | undefined;

  for (const bundle of bundles) {
    if (bundle) {
      Object.assign(contents, bundle.contents);
      if (bundle.uri) {
        lastUri = bundle.uri;
      }
    }
  }

  return { contents, uri: lastUri };
}

/**
 * Create a l10n configuration for an extension.
 *
 * @param extensionPath Path to the extension directory.
 * @param language Target language.
 * @param bundle Pre-loaded bundle (optional).
 * @returns The configuration.
 */
export function createL10nConfigForExtension(
  extensionPath: string,
  language: string,
  bundle?: L10nBundle
): L10nConfig {
  const normalizedPath = extensionPath.replace(/\\/g, "/");

  return {
    language,
    bundle,
    l10nPath: `${normalizedPath}/l10n`,
  };
}

// Note: All types are exported at their interface definitions above
