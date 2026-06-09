import React, { useState } from 'react';
import api from '../api';

function ScanModal({ visible, onClose, onSuccess, onRefresh }) {
  const [qrCode, setQrCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  if (!visible) return null;

  const handleScan = async () => {
    if (!qrCode.trim()) {
      alert('请输入二维码内容');
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const res = await api.post('/orders/scan', { qr_code: qrCode.trim() });
      setResult(res.data);
      if (res.data.valid) {
        setTimeout(() => {
          onSuccess && onSuccess(res.data.order);
        }, 1500);
      }
    } catch (err) {
      setResult(err.response?.data || { valid: false, message: err.message, error_code: 'UNKNOWN_ERROR' });
    } finally {
      setScanning(false);
    }
  };

  const handleQuickScan = (code) => {
    setQrCode(code);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📱 扫码核验</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="qr-placeholder">
            <div>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>📷</div>
              <div>模拟扫码：输入二维码内容</div>
            </div>
          </div>

          <div className="form-group">
            <label>二维码内容</label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="请输入或选择二维码内容"
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>快速选择（演示用）：</div>
            <div className="quick-actions">
              <button className="quick-btn" onClick={() => handleQuickScan('INVALID123456')}>❌ 无效码</button>
              <button className="quick-btn" onClick={() => handleQuickScan('QRD4E5F6G7H8I9J0')}>🔁 重复码(已完成)</button>
              <button className="quick-btn" onClick={() => handleQuickScan('QRB2C3D4E5F6G7H8')}>⏳ 待审核单</button>
              <button className="quick-btn" onClick={() => handleQuickScan('QRC3D4E5F6G7H8I9')}>⏳ 待复核单</button>
            </div>
          </div>

          {result && (
            <div className={`scan-result ${result.valid ? 'success' : 'error'}`}>
              <div className="icon">{result.valid ? '✅' : '❌'}</div>
              <div className="message">{result.message}</div>
              {result.error_code && (
                <div className="error-code">错误码：{result.error_code}</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn" onClick={handleScan} disabled={scanning}>
            {scanning ? '核验中...' : '开始核验'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScanModal;
