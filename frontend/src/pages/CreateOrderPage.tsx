import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { api, extractError } from '../services/api';
import { Role, OrderStatus } from '../types';

const CreateOrderPage: React.FC = () => {
  const { currentUser } = useAppStore();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    venueName: '',
    venueType: '',
    bookingDate: '',
    bookingTime: '',
    applicantName: '',
    applicantPhone: '',
    applicantIdCard: '',
    comment: '',
  });

  const [materials, setMaterials] = useState([
    { type: 'id_card', name: '身份证复印件', uploaded: false, required: true },
    { type: 'application', name: '场地使用申请书', uploaded: false, required: true },
    { type: 'introduction', name: '单位介绍信', uploaded: false, required: false },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState<any>(null);

  const venueTypes = [
    '田径场',
    '篮球场',
    '足球场',
    '网球场',
    '羽毛球馆',
    '乒乓球馆',
    '游泳馆',
    '健身房',
    '多功能厅',
    '其他',
  ];

  const timeSlots = [
    '08:00-10:00',
    '10:00-12:00',
    '14:00-16:00',
    '16:00-18:00',
    '18:00-20:00',
    '20:00-22:00',
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMaterialToggle = (index: number, uploaded: boolean) => {
    setMaterials((prev) =>
      prev.map((m, i) => (i === index ? { ...m, uploaded } : m)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || currentUser.role !== Role.REGISTRAR) {
      setError({ message: '只有场地登记员可以新增订单' });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api
        .withOperator(currentUser.id)
        .orders.create({
          ...formData,
          materials: materials.map((m) => ({
            type: m.type,
            uploaded: m.uploaded,
          })),
          comment: formData.comment,
        });

      setSuccess({
        message: '订单创建成功',
        orderNo: response.data.orderNo,
        qrCode: response.data.qrCode,
        status: response.data.status,
        statusLabel: response.data.statusLabel,
      });

      setTimeout(() => {
        navigate(`/orders/${response.data.id}`);
      }, 2000);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.venueName.trim() &&
    formData.venueType &&
    formData.bookingDate &&
    formData.bookingTime &&
    formData.applicantName.trim() &&
    formData.applicantPhone.trim() &&
    formData.applicantIdCard.trim() &&
    formData.comment.trim();

  const missingRequiredMaterials = materials.filter(
    (m) => m.required && !m.uploaded,
  ).length;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">➕ 新增场地订单</h2>
        <button
          className="btn btn-default btn-sm"
          onClick={() => navigate('/orders')}
        >
          ← 返回列表
        </button>
      </div>

      {currentUser?.role !== Role.REGISTRAR && (
        <div className="error-box" style={{ marginBottom: '20px' }}>
          <div className="error-title">❌ 权限不足</div>
          <div className="error-message">只有场地登记员可以新增订单</div>
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginBottom: '20px' }}>
          <div className="error-title">❌ 提交失败</div>
          <div className="error-message">{error.message}</div>
          {error.details && (
            <div className="error-details">
              <pre>{JSON.stringify(error.details, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="success-box" style={{ marginBottom: '20px' }}>
          <div className="success-title">✅ {success.message}</div>
          <div className="error-message">
            订单编号: <code>{success.orderNo}</code> | 二维码:{' '}
            <code>{success.qrCode}</code>
          </div>
          <div style={{ marginTop: '8px' }}>
            状态:{' '}
            <span className={`status-tag ${success.status}`}>
              {success.statusLabel}
            </span>
          </div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#888' }}>
            正在跳转到订单详情页...
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3 className="section-title">场地信息</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">场地名称</label>
            <input
              type="text"
              value={formData.venueName}
              onChange={(e) => handleInputChange('venueName', e.target.value)}
              placeholder="如：主体育场、篮球馆"
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">场地类型</label>
            <select
              value={formData.venueType}
              onChange={(e) => handleInputChange('venueType', e.target.value)}
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            >
              <option value="">请选择场地类型</option>
              {venueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">预约日期</label>
            <input
              type="date"
              value={formData.bookingDate}
              onChange={(e) => handleInputChange('bookingDate', e.target.value)}
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">预约时段</label>
            <select
              value={formData.bookingTime}
              onChange={(e) => handleInputChange('bookingTime', e.target.value)}
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            >
              <option value="">请选择时段</option>
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3 className="section-title">申请人信息</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">申请人姓名</label>
            <input
              type="text"
              value={formData.applicantName}
              onChange={(e) => handleInputChange('applicantName', e.target.value)}
              placeholder="请输入申请人姓名"
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">联系电话</label>
            <input
              type="tel"
              value={formData.applicantPhone}
              onChange={(e) => handleInputChange('applicantPhone', e.target.value)}
              placeholder="请输入手机号码"
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">身份证号</label>
            <input
              type="text"
              value={formData.applicantIdCard}
              onChange={(e) => handleInputChange('applicantIdCard', e.target.value)}
              placeholder="请输入身份证号码"
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
          </div>
        </div>

        <h3 className="section-title">材料清单</h3>
        <div className="material-list">
          {materials.map((material, index) => (
            <div
              key={material.type}
              className={`material-item ${material.required ? 'required' : ''}`}
            >
              <span
                className={`material-status ${material.uploaded ? 'uploaded' : 'missing'}`}
              >
                {material.uploaded ? '✓' : '!'}
              </span>
              <span style={{ flex: 1 }}>{material.name}</span>
              <span style={{ fontSize: '12px', color: '#888', marginRight: '12px' }}>
                {material.type}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={material.uploaded}
                  onChange={(e) => handleMaterialToggle(index, e.target.checked)}
                  disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
                />
                <span style={{ fontSize: '12px' }}>
                  {material.uploaded ? '已上传' : '标记已上传'}
                </span>
              </label>
            </div>
          ))}
        </div>

        {missingRequiredMaterials > 0 && (
          <div className="info-box" style={{ marginTop: '12px' }}>
            <p style={{ margin: 0 }}>
              <span style={{ color: '#f59e0b' }}>
                ⚠️ 还有 {missingRequiredMaterials} 项必填材料未上传，
                提交后订单将进入"待补正"状态
              </span>
            </p>
          </div>
        )}

        <h3 className="section-title">登记意见</h3>
        <div className="form-row">
          <div className="form-group full-width">
            <label className="form-label required">处理意见</label>
            <textarea
              value={formData.comment}
              onChange={(e) => handleInputChange('comment', e.target.value)}
              placeholder="请输入登记意见，必填"
              disabled={isSubmitting || currentUser?.role !== Role.REGISTRAR}
            />
            <div className="help-text">
              处理意见将作为审计记录永久保存
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-default"
            onClick={() => navigate('/orders')}
            disabled={isSubmitting}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              isSubmitting ||
              !isFormValid ||
              currentUser?.role !== Role.REGISTRAR
            }
          >
            {isSubmitting ? (
              <>
                <span className="loading"></span> 提交中...
              </>
            ) : (
              '提交登记'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrderPage;
