/**
 * Extension Contributions System
 *
 * Central module for all extension contribution types.
 * Extensions can contribute various features to Cortex IDE through this system.
 *
 * Currently supported contributions:
 * - Views: View containers and views in the sidebar
 * - Menus: Context menus, command palette, and various menu locations
 *
 * @module extension-host/contributions
 */

// ============================================================================
// Views Contribution
// ============================================================================

export type {
  // Registration types
  RegisteredViewContainer,
  RegisteredView,
  ViewContainerRegistrationOptions,
  ViewRegistrationOptions,

  // Event types
  ViewContainerRegisteredEvent,
  ViewRegisteredEvent,
  ViewVisibilityChangedEvent,
  ViewContainerVisibilityChangedEvent,

  // API interface
  ViewsApi,
} from "./views";

export {
  // Registry class
  ViewsContributionRegistry,

  // Singleton access
  getViewsRegistry,
  resetViewsRegistry,

  // API factory
  createViewsApi,
} from "./views";

// Re-export workbench types for convenience
export type { ViewContainer, View } from "../../types/workbench";

// ============================================================================
// Menus Contribution
// ============================================================================

export type {
  // Menu location types
  MenuLocation,

  // Item types
  MenuItem,
  RegisteredMenuItem,
  Submenu,
  RegisteredSubmenu,

  // Resolved types
  ResolvedMenuItem,

  // Event types
  MenusChangedEvent,

  // Context types
  WhenClauseContext,

  // API interface
  MenusApi,
} from "./menus";

export {
  // Classes
  WhenClauseEvaluator,
  MenuRegistry,

  // Singleton access
  getGlobalMenuRegistry,
  resetGlobalMenuRegistry,

  // API factory
  createMenusApi,

  // Helpers
  createDefaultContextProvider,
} from "./menus";

// ============================================================================
// Configuration Contribution
// ============================================================================

export type {
  // Schema types
  ConfigurationPropertySchema,
  ConfigurationNode,
  ConfigurationContribution,

  // Registration types
  RegisteredConfiguration,
  RegisteredConfigurationProperty,
  ConfigurationRegistrationOptions,

  // Event types
  ConfigurationChangedEvent,

  // Inspection types
  ConfigurationInspection,

  // API interface
  ConfigurationApi,
} from "./configuration";

export {
  // Registry class
  ConfigurationContributionRegistry,

  // Singleton access
  getConfigurationRegistry,
  resetConfigurationRegistry,

  // API factory
  createConfigurationApi,

  // Helper functions
  createSettingChangeEvent,
  parseConfigurationKey,
  buildConfigurationKey,
} from "./configuration";

// Re-export settings types for convenience
export type {
  ConfigurationScope,
  ConfigurationTarget,
  SettingRegistration,
  SettingChangeEvent,
} from "./configuration";
