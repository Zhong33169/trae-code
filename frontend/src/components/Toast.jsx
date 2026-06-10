import React from 'react';

function Toast({ type, message }) {
  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{iconMap[type] || 'ℹ'}</span>
      <span className="toast-message">{message}</span>
    </div>
  );
}

export default Toast;
