import { create } from 'zustand';
import type { User, Ticket, TicketDetail, DashboardStats, TicketLog } from '@/types';
import { api } from '@/api/client';

interface AppState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  dashboardStats: DashboardStats | null;
  tickets: Ticket[];
  ticketsTotal: number;
  currentTicket: TicketDetail | null;
  logs: TicketLog[];
  logsTotal: number;

  loading: Record<string, boolean>;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;

  fetchDashboardStats: () => Promise<void>;
  fetchTickets: (params?: Record<string, any>) => Promise<void>;
  fetchTicketDetail: (id: number) => Promise<void>;
  createTicket: (data: any) => Promise<number>;
  executeAction: (id: number, data: any) => Promise<void>;
  fetchLogs: (params?: Record<string, any>) => Promise<void>;

  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,

  dashboardStats: null,
  tickets: [],
  ticketsTotal: 0,
  currentTicket: null,
  logs: [],
  logsTotal: 0,

  loading: {},
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: { ...get().loading, login: true }, error: null });
    try {
      const result = await api.auth.login(username, password);
      localStorage.setItem('token', result.token);
      set({
        user: result.user,
        token: result.token,
        isAuthenticated: true,
        loading: { ...get().loading, login: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, login: false },
      });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      dashboardStats: null,
      tickets: [],
      currentTicket: null,
    });
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const user = await api.auth.me();
      set({ user, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  fetchDashboardStats: async () => {
    set({ loading: { ...get().loading, dashboard: true } });
    try {
      const stats = await api.stats.dashboard();
      set({
        dashboardStats: stats,
        loading: { ...get().loading, dashboard: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, dashboard: false },
      });
    }
  },

  fetchTickets: async (params = {}) => {
    set({ loading: { ...get().loading, tickets: true } });
    try {
      const result = await api.tickets.list(params);
      set({
        tickets: result.items,
        ticketsTotal: result.total,
        loading: { ...get().loading, tickets: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, tickets: false },
      });
    }
  },

  fetchTicketDetail: async (id: number) => {
    set({ loading: { ...get().loading, ticketDetail: true } });
    try {
      const ticket = await api.tickets.detail(id);
      set({
        currentTicket: ticket,
        loading: { ...get().loading, ticketDetail: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, ticketDetail: false },
      });
    }
  },

  createTicket: async (data: any) => {
    set({ loading: { ...get().loading, createTicket: true } });
    try {
      const result = await api.tickets.create(data);
      set({ loading: { ...get().loading, createTicket: false } });
      return result.id;
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, createTicket: false },
      });
      throw err;
    }
  },

  executeAction: async (id: number, data: any) => {
    set({ loading: { ...get().loading, action: true } });
    try {
      const result = await api.tickets.action(id, data);
      set({
        currentTicket: result,
        loading: { ...get().loading, action: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, action: false },
      });
      throw err;
    }
  },

  fetchLogs: async (params = {}) => {
    set({ loading: { ...get().loading, logs: true } });
    try {
      const result = await api.logs.list(params);
      set({
        logs: result.items,
        logsTotal: result.total,
        loading: { ...get().loading, logs: false },
      });
    } catch (err: any) {
      set({
        error: err.message,
        loading: { ...get().loading, logs: false },
      });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
