import { createSignal, createMemo, Accessor } from "solid-js";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export type Locale = "en" | "fr";

export interface TranslationParams {
  [key: string]: string | number;
}

export type TranslationKeys = typeof en;

export type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? NestedKeyOf<T[K], `${Prefix}${K}.`>
          : `${Prefix}${K}`
        : never;
    }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

const LOCALES: Record<Locale, TranslationKeys> = {
  en,
  fr,
};

export const SUPPORTED_LOCALES: { code: Locale; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
];

const STORAGE_KEY = "cortex_locale";

function getInitialLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "en" || stored === "fr")) {
      return stored;
    }
  }

  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "fr") {
      return "fr";
    }
  }

  return "en";
}

const [currentLocale, setCurrentLocale] = createSignal<Locale>(getInitialLocale());

export function getLocale(): Accessor<Locale> {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  setCurrentLocale(locale);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  window.dispatchEvent(new CustomEvent("i18n:locale-changed", { detail: { locale } }));
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

export function t(key: string, params?: TranslationParams): string {
  const locale = currentLocale();
  const translations = LOCALES[locale];
  let value = getNestedValue(translations as unknown as Record<string, unknown>, key);

  if (value === undefined && locale !== "en") {
    value = getNestedValue(LOCALES.en as unknown as Record<string, unknown>, key);
  }

  if (value === undefined) {
    console.warn(`Missing translation for key: ${key}`);
    return key;
  }

  if (params) {
    return interpolate(value, params);
  }

  return value;
}

export function createTranslation() {
  const translate = createMemo(() => {
    const locale = currentLocale();
    return (key: string, params?: TranslationParams): string => {
      const translations = LOCALES[locale];
      let value = getNestedValue(translations as unknown as Record<string, unknown>, key);

      if (value === undefined && locale !== "en") {
        value = getNestedValue(LOCALES.en as unknown as Record<string, unknown>, key);
      }

      if (value === undefined) {
        return key;
      }

      if (params) {
        return interpolate(value, params);
      }

      return value;
    };
  });

  return {
    t: translate,
    locale: currentLocale,
    setLocale,
  };
}

export { currentLocale, LOCALES };
