import { create } from "zustand";
import type { Order, OrderDetail } from "../lib/types";
import { api } from "../lib/api";

interface OrderState {
  orders: Order[];
  selectedOrder: OrderDetail | null;
  selectedOrderId: string | null;
  loading: boolean;
  error: string | null;
  filterStatus: string;
  filterKeyword: string;
  selectedIds: Set<string>;
  fetchOrders: (role?: string) => Promise<void>;
  fetchOrderDetail: (id: string) => Promise<void>;
  setFilterStatus: (status: string) => void;
  setFilterKeyword: (keyword: string) => void;
  setSelectedOrderId: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  clearError: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  selectedOrder: null,
  selectedOrderId: null,
  loading: false,
  error: null,
  filterStatus: "",
  filterKeyword: "",
  selectedIds: new Set<string>(),

  fetchOrders: async (role?: string) => {
    set({ loading: true, error: null });
    const { filterStatus, filterKeyword } = get();
    const res = await api.orders.list({
      status: filterStatus || undefined,
      role: role || undefined,
      keyword: filterKeyword || undefined,
    });
    if (res.success && res.data) {
      set({ orders: res.data, loading: false });
    } else {
      set({ error: res.error?.message || "获取单据列表失败", loading: false });
    }
  },

  fetchOrderDetail: async (id: string) => {
    set({ loading: true, error: null });
    const res = await api.orders.get(id);
    if (res.success && res.data) {
      set({ selectedOrder: res.data, loading: false });
    } else {
      set({ error: res.error?.message || "获取单据详情失败", loading: false });
    }
  },

  setFilterStatus: (status: string) => set({ filterStatus: status }),
  setFilterKeyword: (keyword: string) => set({ filterKeyword: keyword }),

  setSelectedOrderId: (id: string | null) => {
    set({ selectedOrderId: id });
    if (!id) set({ selectedOrder: null });
  },

  toggleSelect: (id: string) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedIds: next });
  },

  selectAll: () => {
    const { orders } = get();
    set({ selectedIds: new Set(orders.map((o) => o.id)) });
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  clearError: () => set({ error: null }),
}));
