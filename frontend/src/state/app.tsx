// ============================================================
// Global Application State
// Provides reactive user context, refresh signals
// ============================================================

import {
  component$,
  createContextId,
  useContext,
  useContextProvider,
  useStore,
  useOnMount,
  $,
  type Signal,
  createSignal,
} from "@builder.io/qwik";
import type { User, UserRole } from "~/types";
import api from "~/services/api";

// ---------- Context IDs ----------
export const CurrentUserContext = createContextId<{
  user: User | null;
  users: User[];
  loading: boolean;
  setUser: (userId: number) => void;
  refreshUsers: () => Promise<void>;
}>("current-user-context");

export const RefreshSignalContext = createContextId<{
  tick: number;
  bump: () => void;
}>("refresh-signal-context");

// ---------- Provider ----------
export const AppStateProvider = component$<{ children: any }>(({ children }) => {
  // Refresh signal
  const [tick, setTick] = createSignal(0);
  const bump = $(() => setTick(tick.value + 1));

  // User state
  const userState = useStore({
    user: null as User | null,
    users: [] as User[],
    loading: true,
    setUser: $((userId: number) => {
      const found = userState.users.find((u) => u.id === userId);
      if (found) userState.user = found;
      // bump refresh so pages re-query with new user id/role
      bump();
    }),
    refreshUsers: $(async () => {
      userState.loading = true;
      try {
        const resp = await api.getUsers();
        if (resp.success && resp.data) {
          userState.users = resp.data;
          if (!userState.user && resp.data.length > 0) {
            userState.user = resp.data[0];
          }
        }
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        userState.loading = false;
      }
    }),
  });

  useOnMount$(async () => {
    await userState.refreshUsers();
  });

  useContextProvider(CurrentUserContext, userState);
  useContextProvider(RefreshSignalContext, {
    get tick() {
      return tick.value;
    },
    bump,
  });

  return <>{children}</>;
});

// ---------- Hooks ----------
export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

export function useRefreshSignal() {
  return useContext(RefreshSignalContext);
}

// ---------- helpers ----------
export function userHasRole(user: User | null, role: UserRole | UserRole[]): boolean {
  if (!user) return false;
  if (Array.isArray(role)) return role.includes(user.role);
  return user.role === role;
}
