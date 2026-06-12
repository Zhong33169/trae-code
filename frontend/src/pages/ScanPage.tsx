import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { api, extractError } from '../services/api';
import { Statistics } from '../types';

const ScanPage: React.FC = () => {
  const { currentUser } = useAppStore();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<any>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const quickCodes = [
    { code: 'QR-V-202506001', desc: '待登记订单' },
    { code: 'QR-V-202506002', desc: '待补正订单' },
    { code: 'QR-V-202506003', desc: '待审核订单' },
    { code: 'QR-V-202506004', desc: '待复核订单' },
    { code: 'QR-V-202506005', desc: '已归档订单(重复)' },
    { code: 'QR-INVALID-001', desc: '无效二维码' },
  ];

  useEffect(() => {
    loadStatistics();
  }, [currentUser]);

  const loadStatistics = async () => {
    if (!currentUser) return;
    setIsLoadingStats(true);
    try {
      const response = await api.withOperator(currentUser.id).orders.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleScan = async () => {
    if (!currentUser || !qrCode.trim()) return;

    setIsScanning(true);
    setScanResult(null);
    setScanError(null);

    try {
      const response = await api.withOperator(currentUser.id).scan.scan(qrCode.trim());
      setScanResult(response.data);
    } catch (error: any) {
      setScanError(extractError(error));
    } finally {
      setIsScanning(false);
    }
  };

  const handleQuickScan = (code: string) => {
    setQrCode(code);
    setTimeout(() => handleScan(), 100);
  };

  const handleViewDetail = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  const handleStatClick = (filter: string) => {
    navigate(`/orders?status=${filter}`);
  };

  const renderErrorDetails = (details: any) => {
    if (!details) return null;

    if (details.missingMaterials) {
      return (
        <div>
          <p style={{ marginBottom: '8px', fontWeight: 500 }}>缺少以下必填材料：</p>
          <ul style={{ paddingLeft: '20px' }}>
            {details.missingMaterials.map((m: any, i: number) => (
              <li key={i}>
                {m.name} ({m.type})
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (details.yourRole && details.orderStatus) {
      return (
        <div>
          <p>
            <strong>您的岗位：</strong>
            {details.yourRoleLabel || details.yourRole}
          </p>
          <p>
            <strong>订单当前状态：</strong>
            {details.orderStatusLabel || details.orderStatus}
          </p>
          {details.allowedRolesForStatus && (
            <div>
              <p style={{ marginTop: '8px', fontWeight: 500 }}>有权限处理此订单的岗位：</p>
              <ul style={{ paddingLeft: '20px' }}>
                {details.allowedRolesForStatus.map((r: any, i: number) => (
                  <li key={i}>{r.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (details.currentHandlerId) {
      return (
        <div>
          <p>
            <strong>订单编号：</strong>
            {details.orderNo}
          </p>
          <p>
            <strong>当前处理人：</strong>
            {details.currentHandlerName}
          </p>
          <p>
            <strong>处理人岗位：</strong>
            {details.currentHandlerRole}
          </p>
          <p>
            <strong>您的信息：</strong>
            {details.yourName} (ID: {details.yourId})
          </p>
        </div>
      );
    }

    if (details.lockHolder) {
      return (
        <div>
          <p>
            <strong>锁定人：</strong>
            {details.lockHolder} ({details.lockHolderRole})
          </p>
          <p style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
            请稍后再试，或联系锁定人释放订单
          </p>
        </div>
      );
    }

    if (details.currentStatus) {
      return (
        <div>
          <p>
            <strong>订单当前状态：</strong>
            {details.currentStatus}
          </p>
          <p>
            <strong>尝试的操作：</strong>
            {details.attemptedAction}
          </p>
          {details.allowedActions && (
            <div>
              <p style={{ marginTop: '8px', fontWeight: 500 }}>当前状态允许的操作：</p>
              <ul style={{ paddingLeft: '20px' }}>
                {details.allowedActions.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return <pre>{JSON.stringify(details, null, 2)}</pre>;
  };

  return (
    <div>
      {statistics && (
        <div className="stats-grid">
          <div
            className="stat-card warning"
            onClick={() => handleStatClick('pending_correction')}
            title="点击查看待补正订单列表"
          >
            <div className="stat-label">待补正</div>
            <div className="stat-value">{statistics.stats.pendingCorrection}</div>
          </div>
          <div
            className="stat-card purple"
            onClick={() => handleStatClick('pending_review')}
            title="点击查看待审核订单列表"
          >
            <div className="stat-label">待审核</div>
            <div className="stat-value">{statistics.stats.pendingReview}</div>
          </div>
          <div
            className="stat-card pink"
            onClick={() => handleStatClick('pending_final_review')}
            title="点击查看待复核订单列表"
          >
            <div className="stat-label">待复核</div>
            <div className="stat-value">{statistics.stats.pendingFinalReview}</div>
          </div>
          <div
            className="stat-card success"
            onClick={() => handleStatClick('archived')}
            title="点击查看已归档订单列表"
          >
            <div className="stat-label">已归档</div>
            <div className="stat-value">{statistics.stats.archived}</div>
          </div>
          <div
            className="stat-card primary"
            onClick={() => handleStatClick('')}
            title="点击查看我的待办"
          >
            <div className="stat-label">我的待办</div>
            <div className="stat-value">{statistics.stats.myTasks}</div>
          </div>
          <div
            className="stat-card error"
            onClick={() => handleStatClick('rejected')}
            title="点击查看已驳回订单"
          >
            <div className="stat-label">已驳回</div>
            <div className="stat-value">{statistics.stats.rejected}</div>
          </div>
        </div>
      )}

      {isLoadingStats && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="loading"></div>
        </div>
      )}

      <div className="scan-container">
        <div className="card">
          <h2 className="card-title">📱 扫码核验场地订单</h2>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '13px' }}>
            输入或扫描场地订单二维码进行核验
          </p>

          <div className="scan-input-group">
            <input
              type="text"
              placeholder="请输入二维码内容，如 QR-V-202506001"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              disabled={isScanning}
            />
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={isScanning || !qrCode.trim()}
            >
              {isScanning ? (
                <>
                  <span className="loading"></span> 核验中...
                </>
              ) : (
                '核验'
              )}
            </button>
          </div>

          <div style={{ marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              快速测试二维码：
            </p>
            <div className="quick-scan-codes">
              {quickCodes.map((item) => (
                <button
                  key={item.code}
                  className="quick-scan-btn"
                  onClick={() => handleQuickScan(item.code)}
                  disabled={isScanning}
                  title={item.desc}
                >
                  {item.code}
                  <span style={{ opacity: 0.6, marginLeft: '4px' }}>
                    ({item.desc})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {scanResult && (
            <div className="scan-result">
              <div className="success-box">
                <div className="success-title">✅ 核验通过</div>
                <div className="error-message">二维码有效，可以继续处理</div>
              </div>

              <div className="card" style={{ marginTop: '16px', padding: '16px' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>订单信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">订单编号</span>
                    <span className="detail-value">{scanResult.order.orderNo}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">场地名称</span>
                    <span className="detail-value">{scanResult.order.venueName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">场地类型</span>
                    <span className="detail-value">{scanResult.order.venueType}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">预约日期</span>
                    <span className="detail-value">
                      {scanResult.order.bookingDate} {scanResult.order.bookingTime}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">申请人</span>
                    <span className="detail-value">{scanResult.order.applicantName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">当前状态</span>
                    <span
                      className={`status-tag ${scanResult.order.status}`}
                    >
                      {scanResult.order.statusLabel}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <p className="detail-label" style={{ marginBottom: '8px' }}>
                    材料清单
                  </p>
                  <div className="material-list">
                    {scanResult.order.materials.map((m: any) => (
                      <div
                        key={m.id}
                        className={`material-item ${m.required ? 'required' : ''}`}
                      >
                        <span
                          className={`material-status ${m.uploaded ? 'uploaded' : 'missing'}`}
                        >
                          {m.uploaded ? '✓' : '!'}
                        </span>
                        <span>{m.name}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>
                          {m.uploaded ? '已上传' : '未上传'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: '16px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleViewDetail(scanResult.orderId)}
                  >
                    查看订单详情 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {scanError && (
            <div className="scan-result">
              <div className="error-box">
                <div className="error-title">❌ 核验失败</div>
                <div className="error-message">{scanError.message}</div>
                {scanError.details && (
                  <div className="error-details">
                    {renderErrorDetails(scanError.details)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="test-scenario">
          <h4>🧪 测试场景说明</h4>
          <ul>
            <li>
              <strong>无效码测试：</strong>使用 QR-INVALID-001 或任意非 QR-V- 开头的编码
            </li>
            <li>
              <strong>重复码测试：</strong>使用 QR-V-202506005（已归档订单）
            </li>
            <li>
              <strong>非当前处理人测试：</strong>切换到其他岗位扫描不属于自己的订单
            </li>
            <li>
              <strong>越权测试：</strong>使用登记员账号扫描待审核订单
            </li>
            <li>
              <strong>证据缺失测试：</strong>使用登记员账号扫描 QR-V-202506001
              （缺少材料）
            </li>
            <li>
              <strong>并发测试：</strong>在两个浏览器窗口同时处理同一订单
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
