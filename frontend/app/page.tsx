'use client';

import { useState } from 'react';
import Header from './components/Header';
import FormList from './components/FormList';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'onboarding' | 'review' | 'store'>('onboarding');

  return (
    <div>
      <Header />

      <div className="tabs">
        <div className="container tabs-content">
          <button
            className={`tab ${activeTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => setActiveTab('onboarding')}
          >
            商家入驻
          </button>
          <button
            className={`tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            资质审核
          </button>
          <button
            className={`tab ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            店铺开通
          </button>
        </div>
      </div>

      <main className="main-content">
        <div className="container">
          {activeTab === 'onboarding' && (
            <FormList statusFilter="ALL" />
          )}
          {activeTab === 'review' && (
            <FormList statusFilter="ALL" />
          )}
          {activeTab === 'store' && (
            <FormList statusFilter="ALL" />
          )}
        </div>
      </main>
    </div>
  );
}
