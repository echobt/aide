import {
  type ColorCustomizations,
  DEFAULT_CUSTOMIZATIONS,
  STORAGE_KEY_CUSTOMIZATIONS,
} from "./types";

export function loadCustomizationsFromStorage(): ColorCustomizations {
  if (typeof localStorage === "undefined") {
    return DEFAULT_CUSTOMIZATIONS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOMIZATIONS);
    if (!stored) {
      return DEFAULT_CUSTOMIZATIONS;
    }

    const parsed = JSON.parse(stored);

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

export function saveCustomizationsToStorage(customizations: ColorCustomizations): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMIZATIONS, JSON.stringify(customizations));
  } catch (e) {
    console.error("[Theme] Failed to save customizations to storage:", e);
  }
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}
