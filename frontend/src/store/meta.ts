import { createContextId, useContext, useContextProvider, useStore } from "@builder.io/qwik";
import type { MetaEnums } from "~/types";

export interface MetaState {
  enums: MetaEnums;
  loaded: boolean;
}

export const MetaContext = createContextId<MetaState>("meta-context");

export function useMetaProvider(): MetaState {
  const state = useStore<MetaState>({
    enums: {},
    loaded: false,
  });
  useContextProvider(MetaContext, state);
  return state;
}

export function useMeta(): MetaState {
  return useContext(MetaContext);
}
