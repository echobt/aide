import {
  createContext,
  useContext,
  ParentProps,
  Accessor,
} from "solid-js";
import {
  ZenModeState,
  ZenModeActions,
  EnhancedZenModeSettings,
  useZenMode as useZenModeHook,
  ZenModeProvider as ZenModeProviderComponent,
  zenModeActive,
  zenModeFullscreen,
  zenModeSavedState,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  updateZenModeSettings,
  DEFAULT_ZEN_MODE_SETTINGS,
  getZenModeTransitionStyle,
  zenModeClasses,
} from "@/components/ZenMode";

export interface ZenModeContextValue {
  state: Accessor<ZenModeState>;
  actions: ZenModeActions;
  isActive: Accessor<boolean>;
  isFullscreen: Accessor<boolean>;
}

const ZenModeContext = createContext<ZenModeContextValue>();

export function ZenModeContextProvider(props: ParentProps) {
  const { state, actions } = useZenModeHook();

  const contextValue: ZenModeContextValue = {
    state,
    actions,
    isActive: zenModeActive,
    isFullscreen: zenModeFullscreen,
  };

  return (
    <ZenModeProviderComponent>
      <ZenModeContext.Provider value={contextValue}>
        {props.children}
      </ZenModeContext.Provider>
    </ZenModeProviderComponent>
  );
}

export function useZenModeContext(): ZenModeContextValue {
  const ctx = useContext(ZenModeContext);
  if (!ctx) {
    throw new Error("useZenModeContext must be used within ZenModeContextProvider");
  }
  return ctx;
}

export {
  zenModeActive,
  zenModeFullscreen,
  zenModeSavedState,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  updateZenModeSettings,
  DEFAULT_ZEN_MODE_SETTINGS,
  getZenModeTransitionStyle,
  zenModeClasses,
};

export type {
  ZenModeState,
  ZenModeActions,
  EnhancedZenModeSettings,
};
