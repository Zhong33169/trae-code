import React, { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useOrderStore } from "../stores/orderStore";
import { api } from "../lib/api";
import { X, Plus } from "lucide-react";

interface NewOrderFormProps {
  onClose: () => void;
}

export default function NewOrderForm({ onClose }: NewOrderFormProps) {
  const { user } = useAuthStore();
  const { fetchOrders } = useOrderStore();
  const [dishName, setDishName] = useState("");
  const [dishCategory, setDishCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName || !dishCategory || !price) {
      setError("菜品名称、分类和价格不能为空");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await api.orders.create({
      dish_name: dishName,
      dish_category: dishCategory,
      price: parseFloat(price),
      description,
    });

    if (res.success) {
      if (user) fetchOrders(user.role);
      onClose();
    } else {
      setError(res.error?.message || "创建失败");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">新建菜品上新单</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">菜品名称 *</label>
            <input
              type="text"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="如：秘制红烧肉"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">菜品分类 *</label>
            <select
              value={dishCategory}
              onChange={(e) => setDishCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">请选择分类</option>
              <option value="热菜">热菜</option>
              <option value="凉菜">凉菜</option>
              <option value="海鲜">海鲜</option>
              <option value="素菜">素菜</option>
              <option value="汤品">汤品</option>
              <option value="主食">主食</option>
              <option value="甜品">甜品</option>
              <option value="饮品">饮品</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">价格 (¥) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="0.00"
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder="菜品详细描述"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-900 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {loading ? "创建中..." : "创建单据"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
