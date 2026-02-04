import { createContext, useContext, ParentProps, createSignal, createEffect, createMemo } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";

export type Theme = "dark" | "light" | "system";

// Stub types for removed VS Code theme support
interface CortexTheme {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
  tokenColors: unknown[];
}

// Stub implementations for removed VS Code theme functions
async function loadAndConvertVSCodeTheme(_themePath: string): Promise<CortexTheme> {
  throw new Error("VS Code theme support has been removed");
}

function applyCortexTheme(_theme: CortexTheme): void {
  // No-op: VS Code theme support has been removed
}

function applyVSCodeThemeToMonaco(_monaco: unknown, _theme: CortexTheme): void {
  // No-op: VS Code theme support has been removed
}

// ============================================================================
// UI Theme Colors
// ============================================================================

interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderActive: string;
}

// ============================================================================
// Editor Colors (Monaco/Code Editor)
// ============================================================================

export interface EditorColors {
  editorBackground: string;
  editorForeground: string;
  editorLineHighlight: string;
  editorSelectionBackground: string;
  editorSelectionForeground: string;
  editorCursor: string;
  editorWhitespace: string;
  editorIndentGuide: string;
  editorIndentGuideActive: string;
  editorLineNumber: string;
  editorLineNumberActive: string;
  editorRuler: string;
  editorGutter: string;
  editorFoldBackground: string;
}

// ============================================================================
// Syntax Highlighting Colors
// ============================================================================

export interface SyntaxColors {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  operator: string;
  function: string;
  variable: string;
  type: string;
  class: string;
  constant: string;
  parameter: string;
  property: string;
  punctuation: string;
  tag: string;
  attribute: string;
  regexp: string;
  escape: string;
  invalid: string;
}

// ============================================================================
// Terminal Colors
// ============================================================================

export interface TerminalColors {
  terminalBackground: string;
  terminalForeground: string;
  terminalCursor: string;
  terminalCursorAccent: string;
  terminalSelection: string;
  terminalBlack: string;
  terminalRed: string;
  terminalGreen: string;
  terminalYellow: string;
  terminalBlue: string;
  terminalMagenta: string;
  terminalCyan: string;
  terminalWhite: string;
  terminalBrightBlack: string;
  terminalBrightRed: string;
  terminalBrightGreen: string;
  terminalBrightYellow: string;
  terminalBrightBlue: string;
  terminalBrightMagenta: string;
  terminalBrightCyan: string;
  terminalBrightWhite: string;
}

// ============================================================================
// Complete Color Customization Interface
// ============================================================================

export interface ColorCustomizations {
  ui: Partial<ThemeColors>;
  editor: Partial<EditorColors>;
  syntax: Partial<SyntaxColors>;
  terminal: Partial<TerminalColors>;
}

// ============================================================================
// Color Token Categories for UI
// ============================================================================

export type ColorToken = 
  | keyof ThemeColors 
  | keyof EditorColors 
  | keyof SyntaxColors 
  | keyof TerminalColors;

export type ColorCategory = "ui" | "editor" | "syntax" | "terminal";

// ============================================================================
// Default Color Palettes
// ============================================================================

// JetBrains Dark Theme
const darkColors: ThemeColors = {
  background: "#18181a",
  backgroundSecondary: "#18181a",
  backgroundTertiary: "#3C3F41",
  foreground: "#D8DEE9",
  foregroundMuted: "#CCCCCC99",
  primary: "#4c9df3",
  primaryHover: "#66aefa",
  secondary: "#565656",
  accent: "#88C0D0",
  success: "#A3BE8C",
  warning: "#EBCB8B",
  error: "#BF616A",
  info: "#88C0D0",
  border: "#2A2A2A",
  borderActive: "#404040",
};

const lightColors: ThemeColors = {
  background: "#ffffff",
  backgroundSecondary: "#f4f4f5",
  backgroundTertiary: "#e4e4e7",
  foreground: "#18181b",
  foregroundMuted: "#71717a",
  primary: "#6366f1",
  primaryHover: "#4f46e5",
  secondary: "#8b5cf6",
  accent: "#0891b2",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#2563eb",
  border: "#e4e4e7",
  borderActive: "#d4d4d8",
};

// Figma Design Editor Colors
const darkEditorColors: EditorColors = {
  editorBackground: "#1A1B1F",            // Figma card background
  editorForeground: "#FFFFFF",            // White text
  editorLineHighlight: "rgba(255,255,255,0.05)",
  editorSelectionBackground: "rgba(255,255,255,0.15)",
  editorSelectionForeground: "#FFFFFF",
  editorCursor: "#FFFFFF",
  editorWhitespace: "rgba(255,255,255,0.1)",
  editorIndentGuide: "rgba(255,255,255,0.05)",
  editorIndentGuideActive: "rgba(255,255,255,0.1)",
  editorLineNumber: "rgba(255,255,255,0.5)",  // Figma line numbers
  editorLineNumberActive: "#FFFFFF",
  editorRuler: "rgba(255,255,255,0.1)",
  editorGutter: "#1A1B1F",
  editorFoldBackground: "rgba(255,255,255,0.05)",
};

const lightEditorColors: EditorColors = {
  editorBackground: "#ffffff",
  editorForeground: "#18181b",
  editorLineHighlight: "#f4f4f5",
  editorSelectionBackground: "#bfdbfe",
  editorSelectionForeground: "#18181b",
  editorCursor: "#6366f1",
  editorWhitespace: "#d4d4d8",
  editorIndentGuide: "#e4e4e7",
  editorIndentGuideActive: "#a1a1aa",
  editorLineNumber: "#a1a1aa",
  editorLineNumberActive: "#52525b",
  editorRuler: "#e4e4e7",
  editorGutter: "#ffffff",
  editorFoldBackground: "#f4f4f5",
};

// Figma Design Exact Syntax Colors
const darkSyntaxColors: SyntaxColors = {
  comment: "rgba(255,255,255,0.5)",  // Line numbers, comments
  string: "#8EFF96",                  // Strings, template literals
  number: "#8EFF96",                  // Numbers
  keyword: "#FEAB78",                 // const, typeof, if, false, true
  operator: "#FFFFFF",                // =, ===, &&, ||
  function: "#66BFFF",                // useTranslation, useState, Object.keys
  variable: "#FFFFFF",                // Default text
  type: "#FEAB78",                    // <boolean>, type annotations
  class: "#66BFFF",                   // Class names
  constant: "#FEAB78",                // false, true, null
  parameter: "#FFFFFF",               // Function parameters
  property: "#FFB7FA",                // .length, .household, .members
  punctuation: "#FFFFFF",             // (), {}, []
  tag: "#FEAB78",                     // JSX tags
  attribute: "#FFB7FA",               // JSX attributes
  regexp: "#8EFF96",                  // Regular expressions
  escape: "#FEAB78",                  // Escape sequences
  invalid: "#ef4444",                 // Invalid code
};

const lightSyntaxColors: SyntaxColors = {
  comment: "#6b7280",
  string: "#16a34a",
  number: "#ca8a04",
  keyword: "#7c3aed",
  operator: "#18181b",
  function: "#2563eb",
  variable: "#a21caf",
  type: "#0891b2",
  class: "#b45309",
  constant: "#ea580c",
  parameter: "#c2410c",
  property: "#4f46e5",
  punctuation: "#52525b",
  tag: "#db2777",
  attribute: "#0891b2",
  regexp: "#dc2626",
  escape: "#b45309",
  invalid: "#dc2626",
};

// JetBrains Dark Terminal Colors
const darkTerminalColors: TerminalColors = {
  terminalBackground: "#18181a",
  terminalForeground: "#D8DEE9",
  terminalCursor: "#FFFFFF",
  terminalCursorAccent: "#18181a",
  terminalSelection: "#40404080",
  terminalBlack: "#3B4252",
  terminalRed: "#BF616A",
  terminalGreen: "#A3BE8C",
  terminalYellow: "#EBCB8B",
  terminalBlue: "#81A1C1",
  terminalMagenta: "#B48EAD",
  terminalCyan: "#88C0D0",
  terminalWhite: "#E5E9F0",
  terminalBrightBlack: "#4C566A",
  terminalBrightRed: "#BF616A",
  terminalBrightGreen: "#A3BE8C",
  terminalBrightYellow: "#EBCB8B",
  terminalBrightBlue: "#81A1C1",
  terminalBrightMagenta: "#B48EAD",
  terminalBrightCyan: "#8FBCBB",
  terminalBrightWhite: "#ECEFF4",
};

const lightTerminalColors: TerminalColors = {
  terminalBackground: "#ffffff",
  terminalForeground: "#18181b",
  terminalCursor: "#6366f1",
  terminalCursorAccent: "#ffffff",
  terminalSelection: "#bfdbfe80",
  terminalBlack: "#18181b",
  terminalRed: "#dc2626",
  terminalGreen: "#16a34a",
  terminalYellow: "#d97706",
  terminalBlue: "#2563eb",
  terminalMagenta: "#9333ea",
  terminalCyan: "#0891b2",
  terminalWhite: "#f4f4f5",
  terminalBrightBlack: "#71717a",
  terminalBrightRed: "#ef4444",
  terminalBrightGreen: "#22c55e",
  terminalBrightYellow: "#f59e0b",
  terminalBrightBlue: "#3b82f6",
  terminalBrightMagenta: "#a855f7",
  terminalBrightCyan: "#06b6d4",
  terminalBrightWhite: "#ffffff",
};

// ============================================================================
// Default Empty Customizations
// ============================================================================

const DEFAULT_CUSTOMIZATIONS: ColorCustomizations = {
  ui: {},
  editor: {},
  syntax: {},
  terminal: {},
};

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_CUSTOMIZATIONS = "cortex-color-customizations";

// ============================================================================
// Context Value Interface
// ============================================================================

interface ThemeContextValue {
  // Base theme
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  isDark: () => boolean;
  
  // Theme preview
  previewTheme: () => Theme | null;
  isPreviewActive: () => boolean;
  startPreview: (theme: Theme) => void;
  stopPreview: () => void;
  applyPreviewedTheme: () => void;
  
  // Effective theme (considers preview state)
  effectiveTheme: () => Theme;
  
  // UI Colors (with customizations applied)
  colors: () => ThemeColors;
  
  // All color categories (with customizations applied)
  editorColors: () => EditorColors;
  syntaxColors: () => SyntaxColors;
  terminalColors: () => TerminalColors;
  
  // Color customizations
  colorCustomizations: () => ColorCustomizations;
  setColorCustomization: <C extends ColorCategory>(
    category: C,
    token: string,
    color: string
  ) => void;
  removeColorCustomization: <C extends ColorCategory>(
    category: C,
    token: string
  ) => void;
  resetCustomizations: () => void;
  resetCategoryCustomizations: (category: ColorCategory) => void;
  
  // Import/Export
  exportCustomizations: () => string;
  importCustomizations: (json: string) => boolean;
  
  // Default colors for reference
  getDefaultColors: () => {
    ui: ThemeColors;
    editor: EditorColors;
    syntax: SyntaxColors;
    terminal: TerminalColors;
  };
  
  // Check if a color has been customized
  hasCustomization: (category: ColorCategory, token: string) => boolean;
  
  // Get count of customizations
  customizationCount: () => number;
  
  // VS Code extension theme support
  activeVSCodeTheme: () => CortexTheme | null;
  applyVSCodeExtensionTheme: (themePath: string) => Promise<void>;
  clearVSCodeExtensionTheme: () => void;
  applyVSCodeThemeToMonaco: (monaco: typeof import("monaco-editor")) => void;
}

const ThemeContext = createContext<ThemeContextValue>();

// ============================================================================
// Helper Functions
// ============================================================================

function loadCustomizationsFromStorage(): ColorCustomizations {
  if (typeof localStorage === "undefined") {
    return DEFAULT_CUSTOMIZATIONS;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOMIZATIONS);
    if (!stored) {
      return DEFAULT_CUSTOMIZATIONS;
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.ui !== "object" ||
      typeof parsed.editor !== "object" ||
      typeof parsed.syntax !== "object" ||
      typeof parsed.terminal !== "object"
    ) {
      console.warn("[Theme] Invalid customizations format in storage, using defaults");
      return DEFAULT_CUSTOMIZATIONS;
    }
    
    return {
      ui: parsed.ui || {},
      editor: parsed.editor || {},
      syntax: parsed.syntax || {},
      terminal: parsed.terminal || {},
    };
  } catch (e) {
    console.error("[Theme] Failed to parse customizations from storage:", e);
    return DEFAULT_CUSTOMIZATIONS;
  }
}

function saveCustomizationsToStorage(customizations: ColorCustomizations): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMIZATIONS, JSON.stringify(customizations));
  } catch (e) {
    console.error("[Theme] Failed to save customizations to storage:", e);
  }
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

// ============================================================================
// Theme Provider Component
// ============================================================================

export function ThemeProvider(props: ParentProps) {
  // Base theme state
  const storedTheme = typeof localStorage !== "undefined" 
    ? (localStorage.getItem("cortex-theme") as Theme | null) 
    : null;
  const [theme, setThemeState] = createSignal<Theme>(storedTheme || "dark");

  // Theme preview state
  const [previewTheme, setPreviewTheme] = createSignal<Theme | null>(null);
  const [_isTransitioning, setIsTransitioning] = createSignal(false);

  // Color customizations state
  const [customizations, setCustomizations] = createStore<ColorCustomizations>(
    loadCustomizationsFromStorage()
  );

  // VS Code extension theme state
  const [activeVSCodeTheme, setActiveVSCodeTheme] = createSignal<CortexTheme | null>(null);

  // Computed: Is preview mode active?
  const isPreviewActive = () => previewTheme() !== null;

  // Computed: Effective theme (preview takes precedence)
  const effectiveTheme = createMemo(() => {
    const preview = previewTheme();
    return preview !== null ? preview : theme();
  });

  // Computed: Is dark mode active? (considers preview)
  const isDark = () => {
    const t = effectiveTheme();
    if (t === "system") {
      return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return t === "dark";
  };

  // Start previewing a theme with transition animation
  const startPreview = (themeToPreview: Theme) => {
    if (themeToPreview === theme() && !isPreviewActive()) {
      return;
    }
    setIsTransitioning(true);
    document.documentElement.classList.add("theme-transitioning");
    setPreviewTheme(themeToPreview);
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsTransitioning(false);
        document.documentElement.classList.remove("theme-transitioning");
      }, 300);
    });
    
    window.dispatchEvent(new CustomEvent("theme:preview-started", {
      detail: { theme: themeToPreview },
    }));
  };

  // Stop previewing and revert to actual theme
  const stopPreview = () => {
    if (!isPreviewActive()) {
      return;
    }
    setIsTransitioning(true);
    document.documentElement.classList.add("theme-transitioning");
    setPreviewTheme(null);
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsTransitioning(false);
        document.documentElement.classList.remove("theme-transitioning");
      }, 300);
    });
    
    window.dispatchEvent(new CustomEvent("theme:preview-stopped"));
  };

  // Apply the previewed theme as the actual theme
  const applyPreviewedTheme = () => {
    const preview = previewTheme();
    if (preview === null) {
      return;
    }
    setPreviewTheme(null);
    setThemeState(preview);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", preview);
    }
    
    window.dispatchEvent(new CustomEvent("theme:preview-applied", {
      detail: { theme: preview },
    }));
  };

  // Get default colors based on current theme
  const getDefaultColors = () => ({
    ui: isDark() ? darkColors : lightColors,
    editor: isDark() ? darkEditorColors : lightEditorColors,
    syntax: isDark() ? darkSyntaxColors : lightSyntaxColors,
    terminal: isDark() ? darkTerminalColors : lightTerminalColors,
  });

  // Computed: UI colors with customizations applied
  const colors = createMemo(() => {
    const defaults = isDark() ? darkColors : lightColors;
    return { ...defaults, ...customizations.ui } as ThemeColors;
  });

  // Computed: Editor colors with customizations applied
  const editorColors = createMemo(() => {
    const defaults = isDark() ? darkEditorColors : lightEditorColors;
    return { ...defaults, ...customizations.editor } as EditorColors;
  });

  // Computed: Syntax colors with customizations applied
  const syntaxColors = createMemo(() => {
    const defaults = isDark() ? darkSyntaxColors : lightSyntaxColors;
    return { ...defaults, ...customizations.syntax } as SyntaxColors;
  });

  // Computed: Terminal colors with customizations applied
  const terminalColors = createMemo(() => {
    const defaults = isDark() ? darkTerminalColors : lightTerminalColors;
    return { ...defaults, ...customizations.terminal } as TerminalColors;
  });

  // Set the theme
  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", t);
    }
  };

  // Set a single color customization
  const setColorCustomization = <C extends ColorCategory>(
    category: C,
    token: string,
    color: string
  ) => {
    if (!isValidHexColor(color)) {
      console.warn(`[Theme] Invalid color format: ${color}. Expected hex color.`);
      return;
    }
    
    setCustomizations(produce((draft) => {
      (draft[category] as Record<string, string>)[token] = color;
    }));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: { ...customizations[category], [token]: color },
    });
    
    // Emit event for other components to react
    window.dispatchEvent(new CustomEvent("theme:color-changed", {
      detail: { category, token, color },
    }));
  };

  // Remove a single color customization
  const removeColorCustomization = <C extends ColorCategory>(
    category: C,
    token: string
  ) => {
    const newCategoryCustomizations = { ...customizations[category] };
    delete (newCategoryCustomizations as Record<string, string>)[token];
    
    setCustomizations(category, reconcile(newCategoryCustomizations));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: newCategoryCustomizations,
    });
    
    window.dispatchEvent(new CustomEvent("theme:color-changed", {
      detail: { category, token, color: null },
    }));
  };

  // Reset all customizations
  const resetCustomizations = () => {
    setCustomizations(reconcile(DEFAULT_CUSTOMIZATIONS));
    saveCustomizationsToStorage(DEFAULT_CUSTOMIZATIONS);
    window.dispatchEvent(new CustomEvent("theme:customizations-reset"));
  };

  // Reset customizations for a specific category
  const resetCategoryCustomizations = (category: ColorCategory) => {
    setCustomizations(category, reconcile({}));
    saveCustomizationsToStorage({
      ...customizations,
      [category]: {},
    });
    window.dispatchEvent(new CustomEvent("theme:category-reset", {
      detail: { category },
    }));
  };

  // Export customizations as JSON
  const exportCustomizations = (): string => {
    return JSON.stringify(customizations, null, 2);
  };

  // Import customizations from JSON
  const importCustomizations = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      
      // Validate structure
      if (typeof parsed !== "object" || parsed === null) {
        console.error("[Theme] Invalid import format: expected object");
        return false;
      }
      
      // Build validated customizations
      const validated: ColorCustomizations = {
        ui: {},
        editor: {},
        syntax: {},
        terminal: {},
      };
      
      // Validate and copy each category
      for (const category of ["ui", "editor", "syntax", "terminal"] as const) {
        if (parsed[category] && typeof parsed[category] === "object") {
          for (const [token, color] of Object.entries(parsed[category])) {
            if (typeof color === "string" && isValidHexColor(color)) {
              (validated[category] as Record<string, string>)[token] = color;
            }
          }
        }
      }
      
      setCustomizations(reconcile(validated));
      saveCustomizationsToStorage(validated);
      window.dispatchEvent(new CustomEvent("theme:customizations-imported"));
      
      return true;
    } catch (e) {
      console.error("[Theme] Failed to import customizations:", e);
      return false;
    }
  };

  // Check if a specific color has been customized
  const hasCustomization = (category: ColorCategory, token: string): boolean => {
    return token in customizations[category];
  };

  // Get total count of customizations
  const customizationCount = (): number => {
    return (
      Object.keys(customizations.ui).length +
      Object.keys(customizations.editor).length +
      Object.keys(customizations.syntax).length +
      Object.keys(customizations.terminal).length
    );
  };

  // VS Code extension theme methods
  const applyVSCodeExtensionThemeHandler = async (themePath: string): Promise<void> => {
    try {
      const cortexTheme = await loadAndConvertVSCodeTheme(themePath);
      setActiveVSCodeTheme(cortexTheme);
      applyCortexTheme(cortexTheme);
      
      // Update base theme to match VS Code theme type
      if (cortexTheme.type === "light") {
        setThemeState("light");
      } else {
        setThemeState("dark");
      }
      
      window.dispatchEvent(new CustomEvent("theme:vscode-extension-applied", {
        detail: { theme: cortexTheme, path: themePath },
      }));
    } catch (error) {
      console.error("[Theme] Failed to load VS Code extension theme:", error);
      throw error;
    }
  };

  const clearVSCodeExtensionTheme = (): void => {
    setActiveVSCodeTheme(null);
    
    // Re-apply default theme colors by triggering the effect
    window.dispatchEvent(new CustomEvent("theme:vscode-extension-cleared"));
  };

  const applyVSCodeThemeToMonacoHandler = (monaco: typeof import("monaco-editor")): void => {
    const theme = activeVSCodeTheme();
    if (theme) {
      applyVSCodeThemeToMonaco(monaco, theme);
    }
  };

  // Apply dark class to document
  createEffect(() => {
    const dark = isDark();
    document.documentElement.classList.toggle("dark", dark);
  });

  // Inject global theme transition styles once
  createEffect(() => {
    const styleId = "theme-transition-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .theme-transitioning,
        .theme-transitioning * {
          transition: background-color 300ms ease-out,
                      color 300ms ease-out,
                      border-color 300ms ease-out,
                      fill 300ms ease-out,
                      stroke 300ms ease-out,
                      box-shadow 300ms ease-out !important;
        }
      `;
      document.head.appendChild(style);
    }
  });

  // Cache for camelCase to kebab-case conversion to avoid repeated regex
  const kebabCaseCache = new Map<string, string>();
  const toKebabCase = (key: string): string => {
    let cached = kebabCaseCache.get(key);
    if (!cached) {
      cached = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      kebabCaseCache.set(key, cached);
    }
    return cached;
  };

  // Apply CSS custom properties for colors using requestAnimationFrame for batched DOM updates
  createEffect(() => {
    const uiColors = colors();
    const edColors = editorColors();
    const synColors = syntaxColors();
    const termColors = terminalColors();
    
    // Use requestAnimationFrame to batch all style changes and avoid layout thrashing
    requestAnimationFrame(() => {
      const root = document.documentElement;
      
      // Apply UI colors
      for (const [key, value] of Object.entries(uiColors)) {
        root.style.setProperty(`--color-${toKebabCase(key)}`, value);
      }
      
      // Apply editor colors
      for (const [key, value] of Object.entries(edColors)) {
        root.style.setProperty(`--color-${toKebabCase(key)}`, value);
      }
      
      // Apply syntax colors
      for (const [key, value] of Object.entries(synColors)) {
        root.style.setProperty(`--syntax-${key}`, value);
      }
      
      // Apply terminal colors
      for (const [key, value] of Object.entries(termColors)) {
        root.style.setProperty(`--color-${toKebabCase(key)}`, value);
      }
      
      // Map theme colors to CSS design system variables (Cursor Dark integration)
      // Backgrounds
      root.style.setProperty("--cortex-bg-base", uiColors.background);
      root.style.setProperty("--cortex-bg-elevated", uiColors.backgroundSecondary);
      root.style.setProperty("--cortex-bg-overlay", uiColors.backgroundTertiary);
      root.style.setProperty("--background-base", uiColors.background);
      root.style.setProperty("--background-stronger", uiColors.backgroundSecondary);
      root.style.setProperty("--background-elevated", uiColors.backgroundTertiary);
      
      // Surfaces
      root.style.setProperty("--cortex-surface-base", uiColors.backgroundSecondary);
      root.style.setProperty("--cortex-surface-raised", uiColors.backgroundSecondary);
      root.style.setProperty("--cortex-surface-hover", uiColors.backgroundTertiary);
      root.style.setProperty("--cortex-surface-active", uiColors.borderActive);
      root.style.setProperty("--surface-base", uiColors.backgroundSecondary);
      root.style.setProperty("--surface-raised", uiColors.backgroundSecondary);
      root.style.setProperty("--surface-raised-hover", uiColors.backgroundTertiary);
      root.style.setProperty("--surface-active", uiColors.borderActive);
      
      // Borders
      root.style.setProperty("--cortex-border-base", uiColors.border);
      root.style.setProperty("--cortex-border-subtle", uiColors.border);
      root.style.setProperty("--cortex-border-focus", uiColors.primary);
      root.style.setProperty("--border-base", uiColors.border);
      root.style.setProperty("--border-weak", uiColors.border);
      root.style.setProperty("--border-subtle", uiColors.border);
      root.style.setProperty("--border-focused", uiColors.primary);
      
      // Text
      root.style.setProperty("--cortex-text-primary", uiColors.foreground);
      root.style.setProperty("--cortex-text-secondary", uiColors.foreground);
      root.style.setProperty("--cortex-text-muted", uiColors.foregroundMuted);
      root.style.setProperty("--cortex-text-disabled", uiColors.foregroundMuted);
      root.style.setProperty("--text-strong", uiColors.foreground);
      root.style.setProperty("--text-base", uiColors.foreground);
      root.style.setProperty("--text-weak", uiColors.foregroundMuted);
      root.style.setProperty("--text-weaker", uiColors.foregroundMuted);
      
      // Accent colors
      root.style.setProperty("--cortex-accent", uiColors.primary);
      root.style.setProperty("--cortex-accent-hover", uiColors.primaryHover);
      root.style.setProperty("--accent", uiColors.accent);
      
      // Status colors
      root.style.setProperty("--cortex-success", uiColors.success);
      root.style.setProperty("--cortex-warning", uiColors.warning);
      root.style.setProperty("--cortex-error", uiColors.error);
      root.style.setProperty("--cortex-info", uiColors.info);
      
      // Editor specific
      root.style.setProperty("--vscode-editor-background", edColors.editorBackground);
      root.style.setProperty("--vscode-editor-foreground", edColors.editorForeground);
      root.style.setProperty("--vscode-editorLineNumber-foreground", edColors.editorLineNumber);
      root.style.setProperty("--vscode-editorLineNumber-activeForeground", edColors.editorLineNumberActive);
      root.style.setProperty("--vscode-editor-selectionBackground", edColors.editorSelectionBackground);
      root.style.setProperty("--vscode-editorCursor-foreground", edColors.editorCursor);
      
      // Panel/sidebar
      root.style.setProperty("--vscode-sideBar-background", uiColors.background);
      root.style.setProperty("--vscode-sideBar-foreground", uiColors.foreground);
      root.style.setProperty("--vscode-sideBarTitle-foreground", uiColors.foreground);
      root.style.setProperty("--vscode-panel-background", uiColors.background);
      root.style.setProperty("--vscode-panel-border", uiColors.border);
      
      // Activity bar
      root.style.setProperty("--vscode-activityBar-background", uiColors.background);
      root.style.setProperty("--vscode-activityBar-foreground", uiColors.foregroundMuted);
      root.style.setProperty("--vscode-activityBar-activeBorder", uiColors.primary);
      
      // Title bar
      root.style.setProperty("--vscode-titleBar-activeBackground", uiColors.background);
      root.style.setProperty("--vscode-titleBar-activeForeground", uiColors.foreground);
      
      // Status bar
      root.style.setProperty("--vscode-statusBar-background", uiColors.background);
      root.style.setProperty("--vscode-statusBar-foreground", uiColors.foregroundMuted);
      
      // List/tree
      root.style.setProperty("--vscode-list-activeSelectionBackground", uiColors.borderActive);
      root.style.setProperty("--vscode-list-activeSelectionForeground", uiColors.foreground);
      root.style.setProperty("--vscode-list-hoverBackground", uiColors.backgroundTertiary);
      root.style.setProperty("--vscode-list-hoverForeground", uiColors.foreground);
      
      // Tabs
      root.style.setProperty("--vscode-tab-activeBackground", uiColors.backgroundSecondary);
      root.style.setProperty("--vscode-tab-activeForeground", uiColors.foreground);
      root.style.setProperty("--vscode-tab-inactiveBackground", uiColors.background);
      root.style.setProperty("--vscode-tab-inactiveForeground", uiColors.foregroundMuted);
      root.style.setProperty("--vscode-editorGroupHeader-tabsBackground", uiColors.background);
      
      // Terminal - all colors including ANSI
      root.style.setProperty("--vscode-terminal-background", termColors.terminalBackground);
      root.style.setProperty("--vscode-terminal-foreground", termColors.terminalForeground);
      root.style.setProperty("--vscode-terminalCursor-foreground", termColors.terminalCursor);
      root.style.setProperty("--vscode-terminalCursor-background", termColors.terminalCursorAccent);
      root.style.setProperty("--vscode-terminal-selectionBackground", termColors.terminalSelection);
      // ANSI colors
      root.style.setProperty("--vscode-terminal-ansiBlack", termColors.terminalBlack);
      root.style.setProperty("--vscode-terminal-ansiRed", termColors.terminalRed);
      root.style.setProperty("--vscode-terminal-ansiGreen", termColors.terminalGreen);
      root.style.setProperty("--vscode-terminal-ansiYellow", termColors.terminalYellow);
      root.style.setProperty("--vscode-terminal-ansiBlue", termColors.terminalBlue);
      root.style.setProperty("--vscode-terminal-ansiMagenta", termColors.terminalMagenta);
      root.style.setProperty("--vscode-terminal-ansiCyan", termColors.terminalCyan);
      root.style.setProperty("--vscode-terminal-ansiWhite", termColors.terminalWhite);
      // Bright ANSI colors
      root.style.setProperty("--vscode-terminal-ansiBrightBlack", termColors.terminalBrightBlack);
      root.style.setProperty("--vscode-terminal-ansiBrightRed", termColors.terminalBrightRed);
      root.style.setProperty("--vscode-terminal-ansiBrightGreen", termColors.terminalBrightGreen);
      root.style.setProperty("--vscode-terminal-ansiBrightYellow", termColors.terminalBrightYellow);
      root.style.setProperty("--vscode-terminal-ansiBrightBlue", termColors.terminalBrightBlue);
      root.style.setProperty("--vscode-terminal-ansiBrightMagenta", termColors.terminalBrightMagenta);
      root.style.setProperty("--vscode-terminal-ansiBrightCyan", termColors.terminalBrightCyan);
      root.style.setProperty("--vscode-terminal-ansiBrightWhite", termColors.terminalBrightWhite);
    });
  });

  const value: ThemeContextValue = {
    theme,
    setTheme,
    isDark,
    previewTheme,
    isPreviewActive,
    startPreview,
    stopPreview,
    applyPreviewedTheme,
    effectiveTheme,
    colors,
    editorColors,
    syntaxColors,
    terminalColors,
    colorCustomizations: () => customizations,
    setColorCustomization,
    removeColorCustomization,
    resetCustomizations,
    resetCategoryCustomizations,
    exportCustomizations,
    importCustomizations,
    getDefaultColors,
    hasCustomization,
    customizationCount,
    // VS Code extension theme support
    activeVSCodeTheme,
    applyVSCodeExtensionTheme: applyVSCodeExtensionThemeHandler,
    clearVSCodeExtensionTheme,
    applyVSCodeThemeToMonaco: applyVSCodeThemeToMonacoHandler,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ============================================================================
// Exported Default Colors for Reference
// ============================================================================

export const DEFAULT_DARK_COLORS = {
  ui: darkColors,
  editor: darkEditorColors,
  syntax: darkSyntaxColors,
  terminal: darkTerminalColors,
};

export const DEFAULT_LIGHT_COLORS = {
  ui: lightColors,
  editor: lightEditorColors,
  syntax: lightSyntaxColors,
  terminal: lightTerminalColors,
};

// ============================================================================
// Color Token Metadata for UI
// ============================================================================

export interface ColorTokenInfo {
  key: string;
  label: string;
  description: string;
}

export const UI_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "background", label: "Background", description: "Main application background" },
  { key: "backgroundSecondary", label: "Secondary Background", description: "Sidebar and panel backgrounds" },
  { key: "backgroundTertiary", label: "Tertiary Background", description: "Nested panel backgrounds" },
  { key: "foreground", label: "Foreground", description: "Primary text color" },
  { key: "foregroundMuted", label: "Muted Foreground", description: "Secondary text and labels" },
  { key: "primary", label: "Primary", description: "Primary accent color" },
  { key: "primaryHover", label: "Primary Hover", description: "Primary color on hover" },
  { key: "secondary", label: "Secondary", description: "Secondary accent color" },
  { key: "accent", label: "Accent", description: "Highlight accent color" },
  { key: "success", label: "Success", description: "Success state color" },
  { key: "warning", label: "Warning", description: "Warning state color" },
  { key: "error", label: "Error", description: "Error state color" },
  { key: "info", label: "Info", description: "Informational state color" },
  { key: "border", label: "Border", description: "Default border color" },
  { key: "borderActive", label: "Active Border", description: "Focused/active border color" },
];

export const EDITOR_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "editorBackground", label: "Background", description: "Editor background" },
  { key: "editorForeground", label: "Foreground", description: "Editor text color" },
  { key: "editorLineHighlight", label: "Line Highlight", description: "Current line highlight" },
  { key: "editorSelectionBackground", label: "Selection Background", description: "Selected text background" },
  { key: "editorSelectionForeground", label: "Selection Foreground", description: "Selected text color" },
  { key: "editorCursor", label: "Cursor", description: "Cursor color" },
  { key: "editorWhitespace", label: "Whitespace", description: "Visible whitespace characters" },
  { key: "editorIndentGuide", label: "Indent Guide", description: "Indentation guide color" },
  { key: "editorIndentGuideActive", label: "Active Indent Guide", description: "Active indentation guide" },
  { key: "editorLineNumber", label: "Line Number", description: "Line number color" },
  { key: "editorLineNumberActive", label: "Active Line Number", description: "Current line number color" },
  { key: "editorRuler", label: "Ruler", description: "Column ruler color" },
  { key: "editorGutter", label: "Gutter", description: "Editor gutter background" },
  { key: "editorFoldBackground", label: "Fold Background", description: "Folded code background" },
];

export const SYNTAX_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "comment", label: "Comment", description: "Code comments" },
  { key: "string", label: "String", description: "String literals" },
  { key: "number", label: "Number", description: "Numeric literals" },
  { key: "keyword", label: "Keyword", description: "Language keywords" },
  { key: "operator", label: "Operator", description: "Operators (+, -, =, etc.)" },
  { key: "function", label: "Function", description: "Function names" },
  { key: "variable", label: "Variable", description: "Variable names" },
  { key: "type", label: "Type", description: "Type names" },
  { key: "class", label: "Class", description: "Class names" },
  { key: "constant", label: "Constant", description: "Constants and enums" },
  { key: "parameter", label: "Parameter", description: "Function parameters" },
  { key: "property", label: "Property", description: "Object properties" },
  { key: "punctuation", label: "Punctuation", description: "Brackets, semicolons, etc." },
  { key: "tag", label: "Tag", description: "HTML/XML tags" },
  { key: "attribute", label: "Attribute", description: "HTML/XML attributes" },
  { key: "regexp", label: "RegExp", description: "Regular expressions" },
  { key: "escape", label: "Escape", description: "Escape sequences" },
  { key: "invalid", label: "Invalid", description: "Invalid/error tokens" },
];

export const TERMINAL_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "terminalBackground", label: "Background", description: "Terminal background" },
  { key: "terminalForeground", label: "Foreground", description: "Terminal text color" },
  { key: "terminalCursor", label: "Cursor", description: "Terminal cursor color" },
  { key: "terminalCursorAccent", label: "Cursor Accent", description: "Cursor text color" },
  { key: "terminalSelection", label: "Selection", description: "Selected text background" },
  { key: "terminalBlack", label: "Black", description: "ANSI black" },
  { key: "terminalRed", label: "Red", description: "ANSI red" },
  { key: "terminalGreen", label: "Green", description: "ANSI green" },
  { key: "terminalYellow", label: "Yellow", description: "ANSI yellow" },
  { key: "terminalBlue", label: "Blue", description: "ANSI blue" },
  { key: "terminalMagenta", label: "Magenta", description: "ANSI magenta" },
  { key: "terminalCyan", label: "Cyan", description: "ANSI cyan" },
  { key: "terminalWhite", label: "White", description: "ANSI white" },
  { key: "terminalBrightBlack", label: "Bright Black", description: "ANSI bright black" },
  { key: "terminalBrightRed", label: "Bright Red", description: "ANSI bright red" },
  { key: "terminalBrightGreen", label: "Bright Green", description: "ANSI bright green" },
  { key: "terminalBrightYellow", label: "Bright Yellow", description: "ANSI bright yellow" },
  { key: "terminalBrightBlue", label: "Bright Blue", description: "ANSI bright blue" },
  { key: "terminalBrightMagenta", label: "Bright Magenta", description: "ANSI bright magenta" },
  { key: "terminalBrightCyan", label: "Bright Cyan", description: "ANSI bright cyan" },
  { key: "terminalBrightWhite", label: "Bright White", description: "ANSI bright white" },
];
