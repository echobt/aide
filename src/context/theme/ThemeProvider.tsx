import { createContext, useContext, ParentProps, createSignal, createEffect, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import type { CortexTheme } from "@/utils/theme-converter";
import type {
  Theme, ThemeColors, EditorColors, SyntaxColors, TerminalColors,
  ColorCustomizations, ThemeContextValue,
} from "./types";
import {
  darkColors, lightColors,
  darkEditorColors, lightEditorColors,
  darkSyntaxColors, lightSyntaxColors,
  darkTerminalColors, lightTerminalColors,
} from "./defaultColors";
import { loadCustomizationsFromStorage } from "./themeHelpers";
import { applyCssVariables } from "./applyCssVariables";
import { createVSCodeThemeHandlers } from "./vscodeTheme";
import { createThemeCustomizations } from "./themeCustomizations";

export type { CortexTheme } from "@/utils/theme-converter";

const ThemeContext = createContext<ThemeContextValue>();

const TRANSITION_STYLES = `
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

export function ThemeProvider(props: ParentProps) {
  const storedTheme = typeof localStorage !== "undefined"
    ? (localStorage.getItem("cortex-theme") as Theme | null)
    : null;
  const [theme, setThemeState] = createSignal<Theme>(storedTheme || "dark");
  const [previewTheme, setPreviewTheme] = createSignal<Theme | null>(null);
  const [_isTransitioning, setIsTransitioning] = createSignal(false);
  const [customizations, setCustomizations] = createStore<ColorCustomizations>(
    loadCustomizationsFromStorage()
  );
  const [activeVSCodeTheme, setActiveVSCodeTheme] = createSignal<CortexTheme | null>(null);

  const isPreviewActive = () => previewTheme() !== null;
  const effectiveTheme = createMemo(() => {
    const preview = previewTheme();
    return preview !== null ? preview : theme();
  });
  const isDark = () => {
    const t = effectiveTheme();
    if (t === "system") {
      return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return t === "dark";
  };

  const startPreview = (themeToPreview: Theme) => {
    if (themeToPreview === theme() && !isPreviewActive()) return;
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

  const stopPreview = () => {
    if (!isPreviewActive()) return;
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

  const applyPreviewedTheme = () => {
    const preview = previewTheme();
    if (preview === null) return;
    setPreviewTheme(null);
    setThemeState(preview);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", preview);
    }
    window.dispatchEvent(new CustomEvent("theme:preview-applied", {
      detail: { theme: preview },
    }));
  };

  // ============================================================================
  // Color Customization Handlers
  // ============================================================================

  const customizationHandlers = createThemeCustomizations(
    customizations,
    setCustomizations,
    isDark,
  );

  // ============================================================================
  // Computed Color Values
  // ============================================================================

  const colors = createMemo(() => {
    const defaults = isDark() ? darkColors : lightColors;
    return { ...defaults, ...customizations.ui } as ThemeColors;
  });
  const editorColors = createMemo(() => {
    const defaults = isDark() ? darkEditorColors : lightEditorColors;
    return { ...defaults, ...customizations.editor } as EditorColors;
  });
  const syntaxColors = createMemo(() => {
    const defaults = isDark() ? darkSyntaxColors : lightSyntaxColors;
    return { ...defaults, ...customizations.syntax } as SyntaxColors;
  });
  const terminalColors = createMemo(() => {
    const defaults = isDark() ? darkTerminalColors : lightTerminalColors;
    return { ...defaults, ...customizations.terminal } as TerminalColors;
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cortex-theme", t);
    }
  };

  // ============================================================================
  // VS Code Theme Handlers
  // ============================================================================

  const vsCodeHandlers = createVSCodeThemeHandlers({
    setCustomizations, setActiveVSCodeTheme, setThemeState, activeVSCodeTheme,
  });

  // ============================================================================
  // Side Effects
  // ============================================================================

  createEffect(() => {
    document.documentElement.classList.toggle("dark", isDark());
  });

  createEffect(() => {
    const styleId = "theme-transition-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = TRANSITION_STYLES;
      document.head.appendChild(style);
    }
  });

  createEffect(() => {
    const ui = colors();
    const ed = editorColors();
    const syn = syntaxColors();
    const term = terminalColors();
    requestAnimationFrame(() => {
      applyCssVariables(ui, ed, syn, term);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: ThemeContextValue = {
    theme, setTheme, isDark,
    previewTheme, isPreviewActive, startPreview, stopPreview,
    applyPreviewedTheme, effectiveTheme,
    colors, editorColors, syntaxColors, terminalColors,
    colorCustomizations: () => customizations,
    setColorCustomization: customizationHandlers.setColorCustomization,
    removeColorCustomization: customizationHandlers.removeColorCustomization,
    resetCustomizations: customizationHandlers.resetCustomizations,
    resetCategoryCustomizations: customizationHandlers.resetCategoryCustomizations,
    exportCustomizations: customizationHandlers.exportCustomizations,
    importCustomizations: customizationHandlers.importCustomizations,
    getDefaultColors: customizationHandlers.getDefaultColors,
    hasCustomization: customizationHandlers.hasCustomization,
    customizationCount: customizationHandlers.customizationCount,
    activeVSCodeTheme,
    applyVSCodeExtensionTheme: vsCodeHandlers.applyVSCodeExtensionTheme,
    applyVSCodeExtensionThemeFromJSON: vsCodeHandlers.applyVSCodeExtensionThemeFromJSON,
    clearVSCodeExtensionTheme: vsCodeHandlers.clearVSCodeExtensionTheme,
    applyVSCodeThemeToMonaco: vsCodeHandlers.applyVSCodeThemeToMonaco,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
