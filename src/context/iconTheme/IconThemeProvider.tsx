import { createContext, useContext, ParentProps, createSignal, createMemo } from "solid-js";
import type { IconDefinition, IconThemeState, IconThemeContextValue } from "./types";
import { BUILTIN_THEMES, setiTheme } from "./themes";

const STORAGE_KEY = "cortex-icon-theme";
const DEFAULT_THEME_ID = "seti";

function loadThemeFromStorage(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME_ID;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.activeThemeId && typeof parsed.activeThemeId === "string") {
        const themeExists = BUILTIN_THEMES.some((t) => t.id === parsed.activeThemeId);
        if (themeExists) {
          return parsed.activeThemeId;
        }
      }
    }
  } catch (e) {
    console.error("[IconTheme] Failed to load theme from storage:", e);
  }

  return DEFAULT_THEME_ID;
}

function saveThemeToStorage(themeId: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const state: IconThemeState = { activeThemeId: themeId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("[IconTheme] Failed to save theme to storage:", e);
  }
}

const IconThemeContext = createContext<IconThemeContextValue>();

export function IconThemeProvider(props: ParentProps) {
  const [activeThemeId, setActiveThemeId] = createSignal<string>(loadThemeFromStorage());

  const themes = () => BUILTIN_THEMES;

  const activeTheme = createMemo(() => {
    const id = activeThemeId();
    const theme = BUILTIN_THEMES.find((t) => t.id === id);
    return theme ?? setiTheme;
  });

  const setIconTheme = (id: string) => {
    const themeExists = BUILTIN_THEMES.some((t) => t.id === id);
    if (!themeExists) {
      console.warn(`[IconTheme] Theme "${id}" not found, using default`);
      return;
    }

    setActiveThemeId(id);
    saveThemeToStorage(id);
    window.dispatchEvent(
      new CustomEvent("icon-theme:changed", {
        detail: { themeId: id },
      })
    );
  };

  const getFileIcon = (filename: string): IconDefinition => {
    const theme = activeTheme();
    const lowerFilename = filename.toLowerCase();

    if (theme.icons.fileNames[filename]) {
      return theme.icons.fileNames[filename];
    }
    if (theme.icons.fileNames[lowerFilename]) {
      return theme.icons.fileNames[lowerFilename];
    }

    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      const extension = filename.slice(lastDotIndex + 1).toLowerCase();
      if (theme.icons.fileExtensions[extension]) {
        return theme.icons.fileExtensions[extension];
      }
    }

    if (filename.startsWith(".") && !filename.includes(".", 1)) {
      const configName = filename.toLowerCase();
      if (theme.icons.fileNames[configName]) {
        return theme.icons.fileNames[configName];
      }
    }

    return theme.icons.file;
  };

  const getFolderIcon = (name: string, open: boolean): IconDefinition => {
    const theme = activeTheme();
    const lowerName = name.toLowerCase();

    if (open) {
      if (theme.icons.folderNamesOpen[name]) {
        return theme.icons.folderNamesOpen[name];
      }
      if (theme.icons.folderNamesOpen[lowerName]) {
        return theme.icons.folderNamesOpen[lowerName];
      }
      if (theme.icons.folderNames[name]) {
        return { ...theme.icons.folderNames[name], icon: theme.icons.folderOpen.icon };
      }
      if (theme.icons.folderNames[lowerName]) {
        return { ...theme.icons.folderNames[lowerName], icon: theme.icons.folderOpen.icon };
      }
      return theme.icons.folderOpen;
    }

    if (theme.icons.folderNames[name]) {
      return theme.icons.folderNames[name];
    }
    if (theme.icons.folderNames[lowerName]) {
      return theme.icons.folderNames[lowerName];
    }
    return theme.icons.folder;
  };

  const value: IconThemeContextValue = {
    activeTheme,
    themes,
    setIconTheme,
    getFileIcon,
    getFolderIcon,
  };

  return <IconThemeContext.Provider value={value}>{props.children}</IconThemeContext.Provider>;
}

export function useIconTheme() {
  const ctx = useContext(IconThemeContext);
  if (!ctx) {
    throw new Error("useIconTheme must be used within IconThemeProvider");
  }
  return ctx;
}

export { BUILTIN_THEMES };
