import React, { useState, useCallback } from 'react';

let showFn = null;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'info', duration = 2500) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg, type }]);
    setTimeout(() => {
      setToasts(ts => ts.filter(t => t.id !== id));
    }, duration);
  }, []);
  showFn = show;
  return (
    <>
      {children}
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
      ))}
    </>
  );
}

export function toast(msg, type = 'info', duration) {
  if (showFn) showFn(msg, type, duration);
  else alert(msg);
}

export default { toast };
