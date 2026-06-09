import { ROLE_OPTIONS } from '../utils/constants'

const USER_DISPLAY_NAMES = {
  wang_ling: '王玲',
  zhang_wei: '张伟',
  li_min: '李敏',
  chen_hao: '陈昊',
  zhao_fang: '赵芳',
}

export default function RoleSwitcher({ currentRole, currentUser, onSwitch }) {
  const displayName = USER_DISPLAY_NAMES[currentUser] || currentUser

  return (
    <div className="role-switcher">
      <div className="role-switcher-header">
        <span className="role-switcher-label">当前角色：</span>
        <span className="current-user-badge">
          👤 {displayName}
        </span>
      </div>
      <div className="role-tabs">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role.value}
            className={`role-tab ${currentRole === role.value ? 'active' : ''}`}
            onClick={() => onSwitch(role.value)}
            style={{
              borderColor: currentRole === role.value ? role.color : '#d9d9d9',
              color: currentRole === role.value ? role.color : '#666',
              background: currentRole === role.value ? `${role.color}15` : 'white',
            }}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  )
}
