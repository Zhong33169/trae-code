import React, { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useOrderStore } from "../stores/orderStore";
import LoginForm from "./LoginForm";
import RoleSwitcher from "./RoleSwitcher";
import QueueList from "./QueueList";
import EvidencePanel from "./EvidencePanel";
import OrderDetailModal from "./OrderDetailModal";
import NewOrderForm from "./NewOrderForm";
import type { OrderDetail } from "../lib/types";

export default function App() {
  const { user, token, login, checkAuth, loading: authLoading, error: authError } = useAuthStore();
  const { selectedOrderId, fetchOrders, fetchOrderDetail, selectedOrder } = useOrderStore();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders(user.role);
    }
  }, [user]);

  const handleSelectOrder = (id: string) => {
    useOrderStore.getState().setSelectedOrderId(id);
    fetchOrderDetail(id);
    setShowDetail(true);
  };

  const handleRefresh = () => {
    if (user) fetchOrders(user.role);
    setShowDetail(false);
  };

  if (!token || !user) {
    return (
      <LoginForm
        onLogin={login}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <RoleSwitcher />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[58%] border-r border-slate-200 bg-white">
          <QueueList
            onSelectOrder={handleSelectOrder}
            selectedOrderId={selectedOrderId}
            onShowNewOrder={() => setShowNewOrder(true)}
          />
        </div>
        <div className="w-[42%] bg-white">
          <EvidencePanel orderId={selectedOrderId} />
        </div>
      </div>

      {showDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setShowDetail(false)}
          onRefresh={handleRefresh}
        />
      )}

      {showNewOrder && (
        <NewOrderForm onClose={() => setShowNewOrder(false)} />
      )}
    </div>
  );
}
