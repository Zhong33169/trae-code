import type { User } from '../types';
import { roleDisplayMap } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
  onCreateClick: () => void;
  canCreate: boolean;
}

export default function Header({ user, onLogout, onCreateClick, canCreate }: Props) {
  return (
    <header style={{
      background: 'white',
      borderBottom: '1px solid #e5e7eb',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '18px',
        }}>
          补
        </div>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#1f2937',
          }}>
            便利店连锁补货申请系统
          </h1>
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#6b7280',
          }}>
            批量变更复核管理
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {canCreate && (
          <button
            onClick={onCreateClick}
            style={{
              padding: '8px 16px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 新建申请
          </button>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          background: '#f3f4f6',
          borderRadius: '8px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#4f46e5',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            {user.display_name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
              {user.display_name}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {roleDisplayMap[user.role]}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            padding: '6px 12px',
            background: 'white',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          退出
        </button>
      </div>
    </header>
  );
}
