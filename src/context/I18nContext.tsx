import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
} from "solid-js";
import {
  Locale,
  TranslationParams,
  currentLocale,
  setLocale,
  t,
  SUPPORTED_LOCALES,
} from "@/i18n";

export interface I18nContextValue {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
  supportedLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextValue>();

export function I18nProvider(props: ParentProps) {
  const translate = createMemo(() => {
    currentLocale();
    return (key: string, params?: TranslationParams) => t(key, params);
  });

  const contextValue: I18nContextValue = {
    locale: currentLocale,
    setLocale,
    t: (key: string, params?: TranslationParams) => translate()(key, params),
    supportedLocales: SUPPORTED_LOCALES,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export { currentLocale, setLocale, t, SUPPORTED_LOCALES };
export type { Locale, TranslationParams };
