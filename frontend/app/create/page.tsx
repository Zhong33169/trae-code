'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { createForm, getCurrentUser } from '../lib/api';
import { FormStatus } from '../types';

export default function CreateFormPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const [formData, setFormData] = useState({
    batchNo: '',
    merchantName: '',
    contact: '',
    phone: '',
    email: '',
    businessLicense: '',
    taxCertificate: '',
    orgCode: '',
    legalPerson: '',
    registeredCapital: '',
    businessScope: '',
    offlineStatus: '',
  });

  useEffect(() => {
    getCurrentUser().then((res) => {
      if (res.success) {
        setCurrentUser(res.data);
        if (res.data.role !== 'CLERK') {
          setMessage({ type: 'error', text: '只有商家入驻登记员可以创建入驻单' });
        }
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.batchNo || !formData.merchantName || !formData.contact || !formData.phone) {
      setMessage({ type: 'error', text: '请填写必填项：批次号、商家名称、联系人、联系电话' });
      return;
    }

    setLoading(true);
    try {
      const res = await createForm({
        ...formData,
        status: FormStatus.DRAFT,
        currentRole: 'CLERK',
      });

      if (res.success) {
        if (res.data.hasException) {
          setMessage({ type: 'warning', text: `入驻单已创建，但存在异常：${res.data.exceptionMessage}` });
        } else {
          setMessage({ type: 'success', text: '入驻单创建成功' });
        }
        setTimeout(() => {
          router.push(`/forms/${res.data.id}`);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: res.error || '创建失败' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '创建失败' });
    } finally {
      setLoading(false);
    }
  }

  if (currentUser?.role !== 'CLERK') {
    return (
      <div>
        <Header />
        <main className="main-content">
          <div className="container">
            <div className="breadcrumb">
              <Link href="/">返回列表</Link>
            </div>
            <div className="detail-card">
              <h2>新建商家入驻单</h2>
              <div className="alert alert-error">
                只有【商家入驻登记员】角色可以创建入驻单，请先切换角色。
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="main-content">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">待处理队列</Link>
            <span className="separator">/</span>
            <span>新建入驻单</span>
          </div>

          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
              <button
                style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setMessage(null)}
              >
                ×
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="detail-card">
              <h2>基本信息</h2>
              <div className="form-grid">
                <div className="form-item">
                  <label>批次号 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={formData.batchNo}
                    onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                    placeholder="如：BATCH-2026-011"
                  />
                </div>
                <div className="form-item">
                  <label>离线台账状态</label>
                  <input
                    type="text"
                    value={formData.offlineStatus}
                    onChange={(e) => setFormData({ ...formData, offlineStatus: e.target.value })}
                    placeholder="如：已提交待审核"
                  />
                </div>
                <div className="form-item full-width">
                  <label>商家名称 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={formData.merchantName}
                    onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                    placeholder="请输入商家全称"
                  />
                </div>
                <div className="form-item">
                  <label>联系人 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="请输入联系人姓名"
                  />
                </div>
                <div className="form-item">
                  <label>联系电话 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="请输入联系电话"
                  />
                </div>
                <div className="form-item">
                  <label>电子邮箱</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="请输入电子邮箱"
                  />
                </div>
                <div className="form-item">
                  <label>法定代表人</label>
                  <input
                    type="text"
                    value={formData.legalPerson}
                    onChange={(e) => setFormData({ ...formData, legalPerson: e.target.value })}
                    placeholder="请输入法定代表人"
                  />
                </div>
                <div className="form-item">
                  <label>注册资本</label>
                  <input
                    type="text"
                    value={formData.registeredCapital}
                    onChange={(e) => setFormData({ ...formData, registeredCapital: e.target.value })}
                    placeholder="如：500万"
                  />
                </div>
                <div className="form-item full-width">
                  <label>经营范围</label>
                  <textarea
                    value={formData.businessScope}
                    onChange={(e) => setFormData({ ...formData, businessScope: e.target.value })}
                    placeholder="请输入经营范围"
                  />
                </div>
              </div>
            </div>

            <div className="detail-card">
              <h2>资质信息</h2>
              <div className="form-grid">
                <div className="form-item">
                  <label>营业执照号</label>
                  <input
                    type="text"
                    value={formData.businessLicense}
                    onChange={(e) => setFormData({ ...formData, businessLicense: e.target.value })}
                    placeholder="请输入营业执照号"
                  />
                </div>
                <div className="form-item">
                  <label>税务登记证</label>
                  <input
                    type="text"
                    value={formData.taxCertificate}
                    onChange={(e) => setFormData({ ...formData, taxCertificate: e.target.value })}
                    placeholder="请输入税务登记证号"
                  />
                </div>
                <div className="form-item">
                  <label>组织机构代码</label>
                  <input
                    type="text"
                    value={formData.orgCode}
                    onChange={(e) => setFormData({ ...formData, orgCode: e.target.value })}
                    placeholder="请输入组织机构代码"
                  />
                </div>
              </div>
            </div>

            <div className="detail-card">
              <div className="action-bar" style={{ border: 'none', padding: 0, margin: 0 }}>
                <Link href="/" className="btn btn-secondary">
                  取消
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '创建中...' : '创建入驻单'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
