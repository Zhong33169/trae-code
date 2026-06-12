'use client';

import { useState } from 'react';
import Header from './components/Header';
import FormList from './components/FormList';

export type TabKey = 'onboarding' | 'review' | 'store';

const tabConfig = {
  onboarding: {
    title: '商家入驻',
    description: '入驻登记、材料补正、退回重提',
    roles: ['CLERK'],
    statuses: ['DRAFT', 'MATERIALS_MISSING', 'REJECTED'],
  },
  review: {
    title: '资质审核',
    description: '受理审核、材料核查、资质判定',
    roles: ['SUPERVISOR'],
    statuses: ['SUBMITTED', 'UNDER_REVIEW'],
  },
  store: {
    title: '店铺开通',
    description: '资质复核、店铺开通、档案归档',
    roles: ['REVIEWER'],
    statuses: ['QUALIFIED', 'STORE_OPENED', 'ARCHIVED'],
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('onboarding');

  return (
    <div>
      <Header />

      <div className="tabs">
        <div className="container tabs-content">
          <button
            className={`tab ${activeTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => setActiveTab('onboarding')}
          >
            <div className="tab-title">商家入驻</div>
            <div className="tab-subtitle">登记员发起 / 补正</div>
          </button>
          <button
            className={`tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <div className="tab-title">资质审核</div>
            <div className="tab-subtitle">审核主管办理</div>
          </button>
          <button
            className={`tab ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <div className="tab-title">店铺开通</div>
            <div className="tab-subtitle">复核负责人归档</div>
          </button>
        </div>
      </div>

      <main className="main-content">
        <div className="container">
          {activeTab === 'onboarding' && (
            <FormList tabKey="onboarding" tabConfig={tabConfig.onboarding} />
          )}
          {activeTab === 'review' && (
            <FormList tabKey="review" tabConfig={tabConfig.review} />
          )}
          {activeTab === 'store' && (
            <FormList tabKey="store" tabConfig={tabConfig.store} />
          )}
        </div>
      </main>
    </div>
  );
}
